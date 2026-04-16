export default async function handler(req, res) {
  try {
    const r = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://homebudget-bot.vercel.app",
        "X-Title": "Home Budget Agent",
      },
      body: JSON.stringify({
        model: "google/gemma-4-26b-a4b-it:free",
        messages: [{ role: "user", content: "say hi" }],
        max_tokens: 10,
      }),
    });
    const text = await r.text();
    res.status(200).json({ status: r.status, body: text.slice(0, 500) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
