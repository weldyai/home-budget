import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ALLOWED_IDS = process.env.ALLOWED_USER_IDS.split(",").map(Number);
const BRAHIM_ID = ALLOWED_IDS[0];

// ── VISION (photo/receipt OCR) ──────────────────────────────────────────────
const VISION_MODELS = [
  "qwen/qwen2.5-vl-72b-instruct:free",
  "meta-llama/llama-3.2-11b-vision-instruct:free",
];

const VISION_PROMPT = `Tu es un expert en lecture de tickets de caisse et factures marocains.
Analyse l'image et retourne UNIQUEMENT un tableau JSON des dépenses détectées.

Règles:
- Ticket de courses (supermarché, épicerie, pharmacie) → UNE dépense avec le montant TOTAL et le nom du magasin comme description
- Restaurant, café → UNE dépense avec le total et le nom de l'établissement
- Facture avec articles de catégories clairement différentes → plusieurs dépenses séparées
- Si montant illisible ou image floue → confidence < 0.5

Format tableau JSON:
[{"amount":<décimal>,"currency":"MAD","category":"<cat>","description":"<magasin ou article>","paid_by":"unknown","paid_for":"both","date":"YYYY-MM-DD","confidence":<0.0-1.0>}]

Catégories disponibles: alimentation, restauration, transport, logement, sante, loisirs, habillement, education, services, autre
Réponds UNIQUEMENT avec le tableau JSON, aucun texte avant ou après.`;

async function get_telegram_file_url(file_id) {
  const res = await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/getFile?file_id=${file_id}`
  );
  const data = await res.json();
  return `https://api.telegram.org/file/bot${process.env.TELEGRAM_TOKEN}/${data.result.file_path}`;
}

async function extract_from_image(image_url, today) {
  const img_res = await fetch(image_url);
  const buffer = await img_res.arrayBuffer();
  const base64 = Buffer.from(buffer).toString("base64");
  const mime = image_url.toLowerCase().includes(".png") ? "image/png" : "image/jpeg";

  for (const model of VISION_MODELS) {
    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/home-budget-agent",
          "X-Title": "Home Budget Agent",
        },
        body: JSON.stringify({
          model,
          messages: [{
            role: "user",
            content: [
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
              { type: "text", text: `Date d'aujourd'hui: ${today}\n\n${VISION_PROMPT}` },
            ],
          }],
          temperature: 0.1,
          max_tokens: 600,
        }),
      });

      if (!res.ok) {
        console.error(`[vision] ${model} → ${res.status}: ${await res.text()}`);
        continue;
      }

      const data = await res.json();
      let content = data.choices[0].message.content.trim();
      if (content.startsWith("```")) {
        content = content.split("\n").slice(1, -1).join("\n");
      }
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (e) {
      console.error(`[vision] ${model}:`, e.message);
      continue;
    }
  }
  throw new Error("Impossible d'analyser l'image");
}

async function handlePhoto(msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  if (!ALLOWED_IDS.includes(userId)) return;

  const photo = msg.photo[msg.photo.length - 1];
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });

  await sendMessage(chatId, "🔍 Analyse du ticket en cours...");

  let expenses;
  try {
    const file_url = await get_telegram_file_url(photo.file_id);
    expenses = await extract_from_image(file_url, today);
  } catch (e) {
    console.error("[handlePhoto] vision failed:", e.message);
    await sendMessage(chatId, `❌ Impossible d'analyser l'image: ${e.message}`);
    return;
  }

  for (const expense of expenses) {
    if (expense.paid_by === "unknown") {
      expense.paid_by = userId === BRAHIM_ID ? "brahim" : "wife";
    }

    const icon = EMOJI[expense.category] || "💰";
    const desc = (expense.description || expense.category).slice(0, 20);
    const cb_data = `ok|${expense.amount}|${expense.currency || "MAD"}|${expense.category}|${expense.paid_by}|${expense.paid_for || "both"}|${expense.date || today}|${desc}`;

    await sendMessage(
      chatId,
      `${icon} Ticket détecté — confirmer ?\n\n${expense.amount} ${expense.currency || "MAD"} — ${expense.description}\nCatégorie : ${expense.category}\nConfiance : ${(expense.confidence * 100).toFixed(0)}%\nPayé par : ${expense.paid_by}\nDate : ${expense.date || today} ${time}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Oui", callback_data: cb_data },
            { text: "❌ Non", callback_data: "no" },
          ]],
        },
      }
    );
  }
}

const EMOJI = { alimentation: "🛒", restauration: "🍽️", transport: "🚗", logement: "🏠", sante: "💊", loisirs: "🎬", habillement: "👗", education: "📚", services: "📱", autre: "💰" };

const SYSTEM_PROMPT = `Tu es un classificateur de dépenses pour un budget familial marocain.
Analyse le message et retourne UNIQUEMENT un objet JSON valide avec ces champs :
{"amount":<décimal>,"currency":"MAD|EUR|USD","category":"<cat>","subcategory":"<str|null>","description":"<str>","paid_by":"brahim|wife|unknown","paid_for":"brahim|wife|both","date":"YYYY-MM-DD","confidence":<0-1>}
Catégories : alimentation, restauration, transport, logement, sante, loisirs, habillement, education, services, autre
Règles : currency par défaut MAD, date par défaut aujourd'hui, paid_for par défaut both.
Réponds UNIQUEMENT avec le JSON, aucun texte avant ou après.`;

async function classifyOne(message, today) {
  const models = [
    "llama-3.3-70b-versatile",
    "llama-3.1-70b-versatile",
    "mixtral-8x7b-32768",
  ];

  for (const model of models) {
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: `Date: ${today}\n\nMessage: ${message}` },
          ],
          temperature: 0.1,
          max_tokens: 300,
        }),
      });

      if (!res.ok) {
        console.error(`[classify] ${model} → ${res.status}: ${await res.text()}`);
        continue;
      }

      const data = await res.json();
      let content = data.choices[0].message.content.trim();
      if (content.startsWith("```")) {
        content = content.split("\n").slice(1, -1).join("\n");
      }
      return JSON.parse(content);
    } catch (e) {
      console.error(`[classify] ${model} error:`, e.message);
      continue;
    }
  }
  throw new Error("Classification impossible");
}

async function classify(message, today) {
  const lines = message.split("\n").map(l => l.trim()).filter(Boolean);
  if (lines.length > 1) {
    return Promise.all(lines.map(line => classifyOne(line, today)));
  }
  return [await classifyOne(message, today)];
}

async function telegramRequest(method, body) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function sendMessage(chatId, text, extra = {}) {
  await telegramRequest("sendMessage", { chat_id: chatId, text, ...extra });
}

async function answerCallback(callbackQueryId) {
  await telegramRequest("answerCallbackQuery", { callback_query_id: callbackQueryId });
}

async function editMessage(chatId, messageId, text) {
  await telegramRequest("editMessageText", { chat_id: chatId, message_id: messageId, text });
}

async function handleMessage(msg) {
  const userId = msg.from.id;
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!ALLOWED_IDS.includes(userId) || !text || text.startsWith("/")) return;

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const time = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Casablanca" });

  let expenses;
  try {
    expenses = await classify(text, today);
  } catch (e) {
    console.error("[handleMessage] classify failed:", e.message);
    await sendMessage(chatId, `Erreur: ${e.message}`);
    return;
  }

  for (const expense of expenses) {
    if (expense.paid_by === "unknown") {
      expense.paid_by = userId === BRAHIM_ID ? "brahim" : "wife";
    }

    const icon = EMOJI[expense.category] || "💰";
    const desc = (expense.description || expense.category).slice(0, 10);
    const cbData = `ok|${expense.amount}|${expense.currency || "MAD"}|${expense.category}|${expense.paid_by}|${expense.paid_for || "both"}|${expense.date || today}|${desc}`;

    await sendMessage(
      chatId,
      `${icon} Confirmer cette dépense ?\n\n${expense.amount} ${expense.currency || "MAD"} — ${expense.description}\nCatégorie : ${expense.category}\nPayé par : ${expense.paid_by}\nDate : ${expense.date || today} ${time}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "✅ Oui", callback_data: cbData },
            { text: "❌ Non", callback_data: "no" },
          ]],
        },
      }
    );
  }
}

async function handleCallback(cq) {
  const chatId = cq.message.chat.id;
  const userId = cq.from.id;
  const messageId = cq.message.message_id;
  const data = cq.data;

  await answerCallback(cq.id);

  if (!ALLOWED_IDS.includes(userId)) return;

  if (data === "no") {
    await editMessage(chatId, messageId, "❌ Dépense annulée.");
    return;
  }

  if (data.startsWith("del|")) {
    const id = data.slice(4);
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) {
      await editMessage(chatId, messageId, `❌ Erreur: ${error.message}`);
      return;
    }
    await editMessage(chatId, messageId, "🗑 Dépense supprimée.");
    return;
  }

  if (data.startsWith("ok|")) {
    const parts = data.split("|");
    const [, amount, currency, category, paid_by, paid_for, date, ...descParts] = parts;
    const description = descParts.join("|") || category;

    const { error } = await supabase.from("expenses").insert({
      amount: parseFloat(amount),
      currency: currency || "MAD",
      category,
      description,
      paid_by,
      paid_for: paid_for || "both",
      date,
    });

    if (error) {
      await editMessage(chatId, messageId, `❌ Erreur DB: ${error.message}`);
      return;
    }

    const icon = EMOJI[category] || "💰";
    await editMessage(chatId, messageId, `${icon} Enregistré !\n${amount} ${currency} — ${description}\nCatégorie : ${category}\nPayé par : ${paid_by}`);

    for (const otherId of ALLOWED_IDS) {
      if (otherId !== userId) {
        await sendMessage(otherId, `${icon} Nouvelle dépense ajoutée\n${amount} ${currency} — ${description}\nCatégorie : ${category}\nPayé par : ${paid_by}`);
      }
    }
  }
}

async function handleCommand(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!ALLOWED_IDS.includes(userId)) return;

  if (msg.text === "/delete") {
    const paid_by = userId === BRAHIM_ID ? "brahim" : "wife";
    const { data, error } = await supabase
      .from("expenses")
      .select("id, amount, currency, description, category, date")
      .eq("paid_by", paid_by)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data?.length) {
      await sendMessage(chatId, "Aucune dépense à supprimer.");
      return;
    }

    const e = data[0];
    const icon = EMOJI[e.category] || "💰";
    await sendMessage(
      chatId,
      `${icon} Supprimer cette dépense ?\n\n${e.amount} ${e.currency || "MAD"} — ${e.description}\nDate : ${e.date}`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: "🗑 Supprimer", callback_data: `del|${e.id}` },
            { text: "❌ Annuler", callback_data: "no" },
          ]],
        },
      }
    );
    return;
  }

  if (msg.text === "/budget") {
    const month = new Date().toISOString().slice(0, 7);
    const { data } = await supabase
      .from("expenses")
      .select("amount")
      .gte("date", `${month}-01`);

    const total = (data || []).reduce((s, e) => s + Number(e.amount), 0);
    const budget = 5000;
    const restant = budget - total;
    const pct = Math.min((total / budget) * 100, 100).toFixed(0);
    const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
    const emoji = restant >= 0 ? (pct < 60 ? "🟢" : pct < 85 ? "🟡" : "🔴") : "🔴";

    await sendMessage(
      chatId,
      `${emoji} Budget ${month}\n\n${bar} ${pct}%\n\nDépensé : ${total.toFixed(0)} MAD\nRestant  : ${restant.toFixed(0)} MAD\nBudget   : ${budget} MAD`
    );
    return;
  }

  if (msg.text === "/report" || msg.text?.startsWith("/report")) {
    const month = new Date().toISOString().slice(0, 7);
    const { data } = await supabase
      .from("expenses")
      .select("category, amount")
      .gte("date", `${month}-01`);

    if (!data?.length) {
      await sendMessage(chatId, "Aucune dépense ce mois-ci.");
      return;
    }

    const totals = {};
    let total = 0;
    for (const e of data) {
      totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
      total += Number(e.amount);
    }

    const lines = Object.entries(totals)
      .sort((a, b) => b[1] - a[1])
      .map(([cat, amt]) => `  ${cat}: ${amt.toFixed(0)} MAD`);

    await sendMessage(chatId, `📊 Rapport ${month}\n\n${lines.join("\n")}\n\nTotal : ${total.toFixed(0)} MAD`);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    const hasVars = {
      TELEGRAM_TOKEN: !!process.env.TELEGRAM_TOKEN,
      GROQ_API_KEY: !!process.env.GROQ_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_KEY: !!process.env.SUPABASE_KEY,
      ALLOWED_USER_IDS: !!process.env.ALLOWED_USER_IDS,
    };
    res.status(200).json({ status: "ok", env: hasVars });
    return;
  }

  try {
    const { message, callback_query } = req.body;
    if (callback_query) {
      await handleCallback(callback_query);
    } else if (message?.text?.startsWith("/")) {
      await handleCommand(message);
    } else if (message?.photo) {
      await handlePhoto(message);
    } else if (message?.text) {
      await handleMessage(message);
    }
  } catch (e) {
    console.error(e);
  }

  res.status(200).json({ ok: true });
}
