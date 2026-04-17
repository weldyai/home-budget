import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ALLOWED_IDS = process.env.ALLOWED_USER_IDS.split(",").map(Number);
const BRAHIM_ID = ALLOWED_IDS[0];

const EMOJI = { alimentation: "🛒", restauration: "🍽️", transport: "🚗", logement: "🏠", sante: "💊", loisirs: "🎬", habillement: "👗", education: "📚", services: "📱", autre: "💰" };

const SYSTEM_PROMPT = `Tu es un classificateur de dépenses pour un budget familial marocain.
Analyse le message et retourne UNIQUEMENT un objet JSON valide avec ces champs :
{
  "amount": <nombre décimal>,
  "currency": "<MAD|EUR|USD>",
  "category": "<catégorie>",
  "subcategory": "<sous-catégorie ou null>",
  "description": "<description courte>",
  "paid_by": "<brahim|wife|unknown>",
  "paid_for": "<brahim|wife|both>",
  "date": "<YYYY-MM-DD>",
  "confidence": <0.0 à 1.0>
}
Catégories : alimentation, restauration, transport, logement, sante, loisirs, habillement, education, services, autre
Règles : currency par défaut MAD, date par défaut aujourd'hui, paid_for par défaut both.
Réponds UNIQUEMENT avec le JSON, aucun texte avant ou après.`;

async function classify(message, today) {
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

  const today = new Date().toISOString().split("T")[0];

  let expense;
  try {
    expense = await classify(text, today);
  } catch (e) {
    console.error("[handleMessage] classify failed:", e.message);
    await sendMessage(chatId, `Erreur: ${e.message}`);
    return;
  }

  if (expense.paid_by === "unknown") {
    expense.paid_by = userId === BRAHIM_ID ? "brahim" : "wife";
  }

  const icon = EMOJI[expense.category] || "💰";
  const desc = (expense.description || expense.category).slice(0, 10);
  // Format: ok|amount|currency|category|paid_by|paid_for|date|desc (max 64 bytes)
  const cbData = `ok|${expense.amount}|${expense.currency || "MAD"}|${expense.category}|${expense.paid_by}|${expense.paid_for || "both"}|${expense.date || today}|${desc}`;

  await sendMessage(
    chatId,
    `${icon} Confirmer cette dépense ?\n\n${expense.amount} ${expense.currency || "MAD"} — ${expense.description}\nCatégorie : ${expense.category}\nPayé par : ${expense.paid_by}\nDate : ${expense.date || today}`,
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
    } else if (message) {
      await handleMessage(message);
    }
  } catch (e) {
    console.error(e);
  }

  res.status(200).json({ ok: true });
}
