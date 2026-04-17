import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const ALLOWED_IDS = process.env.ALLOWED_USER_IDS.split(",").map(Number);
const BUDGET = 5000;

async function sendMessage(chatId, text) {
  await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
}

export default async function handler(req, res) {
  const auth = req.headers["authorization"];
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const today = new Date();
  const monthStr = today.toISOString().slice(0, 7);

  // Début de semaine (lundi)
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + (today.getDay() === 0 ? -6 : 1));
  const weekStartStr = weekStart.toISOString().slice(0, 10);

  const { data: monthData } = await supabase
    .from("expenses")
    .select("amount, category")
    .gte("date", `${monthStr}-01`);

  const { data: weekData } = await supabase
    .from("expenses")
    .select("amount")
    .gte("date", weekStartStr);

  const monthTotal = (monthData || []).reduce((s, e) => s + Number(e.amount), 0);
  const weekTotal = (weekData || []).reduce((s, e) => s + Number(e.amount), 0);
  const restant = BUDGET - monthTotal;
  const pct = Math.min((monthTotal / BUDGET) * 100, 100).toFixed(0);
  const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
  const emoji = pct < 60 ? "🟢" : pct < 85 ? "🟡" : "🔴";

  // Top catégories du mois
  const totals = {};
  for (const e of monthData || []) {
    totals[e.category] = (totals[e.category] || 0) + Number(e.amount);
  }
  const top3 = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amt]) => `  ${cat}: ${amt.toFixed(0)} MAD`)
    .join("\n");

  const message = `📅 Rappel hebdo — ${monthStr}\n\n${emoji} ${bar} ${pct}%\n\nCette semaine : ${weekTotal.toFixed(0)} MAD\nCe mois      : ${monthTotal.toFixed(0)} MAD\nRestant      : ${restant.toFixed(0)} MAD\n\nTop catégories :\n${top3 || "  Aucune dépense"}`;

  for (const userId of ALLOWED_IDS) {
    await sendMessage(userId, message);
  }

  res.status(200).json({ ok: true });
}
