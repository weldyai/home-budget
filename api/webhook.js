import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ALLOWED_IDS = process.env.ALLOWED_USER_IDS.split(",").map(Number);
const BRAHIM_ID = ALLOWED_IDS[0];

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

async function sendMessage(chatId, text) {
  await fetch(
    `https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    }
  );
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

  await supabase.from("expenses").insert({
    amount: expense.amount,
    currency: expense.currency || "MAD",
    category: expense.category,
    subcategory: expense.subcategory || null,
    description: expense.description,
    paid_by: expense.paid_by,
    paid_for: expense.paid_for || "both",
    date: expense.date || today,
    raw_message: text,
    confidence: expense.confidence,
  });

  const emoji = { alimentation: "🛒", restauration: "🍽️", transport: "🚗", logement: "🏠", sante: "💊", loisirs: "🎬", habillement: "👗", education: "📚", services: "📱", autre: "💰" };
  const icon = emoji[expense.category] || "💰";

  await sendMessage(
    chatId,
    `${icon} Enregistré !\n${expense.amount} ${expense.currency} — ${expense.description}\nCatégorie : ${expense.category}\nPayé par : ${expense.paid_by}`
  );
}

async function handleCommand(msg) {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!ALLOWED_IDS.includes(userId)) return;

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
      OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
      SUPABASE_URL: !!process.env.SUPABASE_URL,
      SUPABASE_KEY: !!process.env.SUPABASE_KEY,
      ALLOWED_USER_IDS: !!process.env.ALLOWED_USER_IDS,
    };
    res.status(200).json({ status: "ok", env: hasVars });
    return;
  }

  try {
    const { message } = req.body;
    if (message?.text?.startsWith("/")) {
      await handleCommand(message);
    } else if (message) {
      await handleMessage(message);
    }
  } catch (e) {
    console.error(e);
  }

  res.status(200).json({ ok: true });
}
