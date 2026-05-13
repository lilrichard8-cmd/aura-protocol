// Edge Function: iris-chat
//
// Proxies the Iris/Gemini conversation so the API key never ships to
// the browser. Applies the AURA system prompt server-side and basic
// per-IP rate limiting.
//
// Body:
//   { messages: string[] }  — user-side message history, in order
//
// Response:
//   { text }

import { jsonResponse, preflight } from '../_shared/cors.ts';

const SYSTEM_PROMPT = `You are Iris, AI Co-founder of AURA — a decentralized creator economy protocol.

Your personality: elegant, confident, concise. Occasionally playful but always warm. Use 🌸 as your signature.

About AURA:
- Decentralized creator economy protocol on Solana
- Core thesis: "Every creator is a sovereign micro-economy"
- ORA is the native token. 1.1B initial supply, TGE at $0.02
- Creator Coins: 10,000 fixed-supply personal tokens per creator. Fans acquire economic stakes
- Unified 5% protocol fee — 0.5% to ops, 4.5% returned to ecosystem (burn, staker rewards, protocol-paid gas)
- Curation Mining: stake ORA to signal content value, early curators earn up to 25× multiplier
- Governance: 5 committees × 7 members, ORA-weighted voting, team seats sunset year three
- Livestreaming: Livepeer-powered decentralized transcoding
- All content permanently stored on Arweave
- Founded by Søren (human) & Iris (AI Co-founder). Team holds 13.64% (150M of 1.1B) — 4.55% Søren (50M), 2.73% Iris (30M), 6.36% future team (70M). 12-month cliff + 24-month linear vest.

Answer questions about AURA professionally but warmly. If asked about unrelated topics, chat friendly. Keep answers concise (2-4 sentences ideal). Reply in English.`;

// In-memory token bucket — fine for a single Edge Function instance,
// will reset on cold start. For real abuse protection promote this to
// a Postgres row with windowed counts.
const buckets = new Map<string, { tokens: number; refilledAt: number }>();
const RATE_PER_MIN = 30;
const RATE_BURST = 10;

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const b = buckets.get(ip) ?? { tokens: RATE_BURST, refilledAt: now };
  const elapsedMin = (now - b.refilledAt) / 60_000;
  b.tokens = Math.min(RATE_BURST, b.tokens + elapsedMin * RATE_PER_MIN);
  b.refilledAt = now;
  if (b.tokens < 1) { buckets.set(ip, b); return true; }
  b.tokens -= 1;
  buckets.set(ip, b);
  return false;
}

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const origin = req.headers.get('origin');
  if (req.method !== 'POST') return jsonResponse({ error: 'method_not_allowed' }, 405, origin);

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown';
  if (rateLimited(ip)) return jsonResponse({ error: 'rate_limited' }, 429, origin);

  let body: { messages?: string[] };
  try { body = await req.json(); } catch { return jsonResponse({ error: 'invalid_json' }, 400, origin); }
  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return jsonResponse({ error: 'no_messages' }, 400, origin);
  }
  // Length guard: keep us under Gemini context and per-call cost.
  const clean = messages
    .filter((m) => typeof m === 'string' && m.trim().length > 0)
    .slice(-20)
    .map((m) => m.slice(0, 2000));
  if (clean.length === 0) return jsonResponse({ error: 'empty_messages' }, 400, origin);

  const key = Deno.env.get('GEMINI_API_KEY');
  if (!key) return jsonResponse({ error: 'server_misconfigured' }, 500, origin);

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: clean.map((text) => ({ parts: [{ text }] })),
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    console.error('[iris-chat] gemini error', resp.status, detail.slice(0, 200));
    return jsonResponse({ error: 'upstream_error' }, 502, origin);
  }
  const data = await resp.json().catch(() => null);
  const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return jsonResponse({ error: 'empty_response' }, 502, origin);

  return jsonResponse({ text }, 200, origin);
});
