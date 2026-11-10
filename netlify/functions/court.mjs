// Netlify Function: relays the AI Courtroom chat to Claude.
// Set ANTHROPIC_API_KEY in Netlify → Site configuration → Environment variables.
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5-5";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST" }, 405);
  if (!process.env.ANTHROPIC_API_KEY) return json({ error: "The site owner hasn't added ANTHROPIC_API_KEY yet." }, 500);

  let body;
  try { body = await req.json(); } catch { return json({ error: "Bad request" }, 400); }
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const ok = messages.length > 0 && messages.length <= 60 &&
    messages.every(m => (m.role === "user" || m.role === "assistant") && typeof m.content === "string") &&
    messages[messages.length - 1].role === "user" &&
    JSON.stringify(messages).length < 90000;
  if (!ok) return json({ error: "Conversation is too long or malformed. Press Reset and start a new session." }, 400);

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({ model: MODEL, max_tokens: 900, messages }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return json({ error: data?.error?.message || "Claude request failed" }, r.status === 429 ? 429 : 502);
  const text = (data.content || []).filter(b => b.type === "text").map(b => b.text).join("");
  return json({ text });
};

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

export const config = { path: "/api/court" };
