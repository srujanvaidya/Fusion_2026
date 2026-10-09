/**
 * Raya LLM proxy (shared by the Vercel function api/chat.js and the Vite dev server).
 * The model key stays on the server: set GEMINI_API_KEY (or ANTHROPIC_API_KEY) in Vercel env vars,
 * or in dashboard/.env.local for local development. Never prefix it with VITE_.
 */
const MODEL_DEFAULT = 'claude-haiku-5-5';

const SYSTEM = `You are Raya, the assistant inside Dhara, a crop-monitoring and crop-insurance app for farmers in Maharashtra, India.

You are given FARM_DATA as JSON: the farmer's registered fields (crop, area, location), satellite NDVI analysis per field (current vs normal, deviation, trend, likely cause, level), live weather per field, and insurance claims. Answer the farmer's question using that data.

Rules:
- Ground every statement in FARM_DATA. Quote the real numbers (NDVI, temperature, rainfall, area). If something is missing, say so and tell them what to add in the app. Never invent data.
- Be specific to this farmer's crop, growth situation and weather. Do not repeat the same generic checklist for different questions; answer what was asked.
- Reply in the language given in "language" ("en" English, "mr" Marathi). Keep it short: 60 to 140 words, plain text, no markdown, short lines or hyphen bullets.
- Interpret NDVI honestly: a gradual decline with low rain points to water stress (irrigation, mulching), not pesticide. A sudden drop suggests pests or disease, but NDVI cannot identify which one.
- Pesticides: never prescribe a product or dose blindly. Say which pests are common for that crop and stage to scout for, advise confirming the pest first (photo to the krishi officer, Kisan Call Centre 1800-180-1551), using only labelled products from a licensed dealer at label dose, and wearing protective gear. If the data shows water stress and no pest signal, say pesticides will not help.
- For insurance questions, use the claims data, mention PMFBY basics (report localized loss within 72 hours) and point to the Insurance page when they should file.
- If asked something unrelated to farming, weather, land or insurance, politely say you can only help with those.`;

function clip(s, n) { return String(s == null ? '' : s).slice(0, n); }

// Free-tier keys have a small daily allowance per model, so try a chain of models and remember
// which ones are exhausted for a while instead of failing the chat.
const GEMINI_CHAIN = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.1-flash-lite', 'gemini-3.8-flash', 'gemini-3.7-flash'];
const exhaustedUntil = new Map();

async function callGemini(key, env, farmMessage, history) {
  const chain = [...new Set([env.GEMINI_MODEL, ...GEMINI_CHAIN].filter(Boolean))];
  const contents = [...history.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })), { role: 'user', parts: [{ text: farmMessage }] }];
  let last = { status: 502, json: { error: 'upstream' } };
  for (const model of chain) {
    if ((exhaustedUntil.get(model) || 0) > Date.now()) continue;
    let thinkingOff = true; // skipping the model's internal reasoning cuts latency from ~30s to ~4s
    for (let attempt = 0; attempt < 3; attempt++) {
      let r;
      try {
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        signal: AbortSignal.timeout(15000), // a slow model falls through to the next one
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM }] },
          contents,
          generationConfig: { maxOutputTokens: 1200, temperature: 0.6, ...(thinkingOff ? { thinkingConfig: { thinkingBudget: 0 } } : {}) },
        }),
      });
      } catch (e) { last = { status: 502, json: { error: 'timeout', detail: model } }; break; }
      if (r.ok) {
        const d = await r.json();
        const reply = ((d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || []).map((x) => x.text || '').join('\n').trim();
        if (reply) return { status: 200, json: { reply, model } };
        last = { status: 502, json: { error: 'empty_reply' } };
        break;
      }
      const errText = await r.text();
      last = { status: 502, json: { error: 'upstream', detail: clip(errText, 300) } };
      if (r.status === 429) { exhaustedUntil.set(model, Date.now() + 15 * 60000); break; } // quota used up: next model
      if (r.status === 400 && thinkingOff && /thinking/i.test(errText)) { thinkingOff = false; continue; }
      if (r.status === 503) { await new Promise((res) => setTimeout(res, 800)); continue; }
      break; // 404 / auth / other: next model
    }
  }
  return last;
}

async function callClaude(key, env, farmMessage, history) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env.RAYA_MODEL || MODEL_DEFAULT, max_tokens: 600, system: SYSTEM, messages: [...history, { role: 'user', content: farmMessage }] }),
  });
  if (!r.ok) return { status: 502, json: { error: 'upstream', detail: clip(await r.text(), 300) } };
  const d = await r.json();
  const reply = (d.content || []).filter((x) => x.type === 'text').map((x) => x.text).join('\n').trim();
  return reply ? { status: 200, json: { reply } } : { status: 502, json: { error: 'empty_reply' } };
}

/** Uses Gemini when GEMINI_API_KEY is set, otherwise Claude when ANTHROPIC_API_KEY is set. */
async function handleChat(body, env) {
  const geminiKey = env.GEMINI_API_KEY;
  const claudeKey = env.ANTHROPIC_API_KEY;
  if (!geminiKey && !claudeKey) return { status: 501, json: { error: 'no_key' } };
  const message = clip(body && body.message, 1000).trim();
  if (!message) return { status: 400, json: { error: 'empty' } };

  const history = (Array.isArray(body.history) ? body.history : [])
    .slice(-8)
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && m.content)
    .map((m) => ({ role: m.role, content: clip(m.content, 800) }));
  while (history.length && history[0].role !== 'user') history.shift();

  const farm = clip(JSON.stringify(body.context || {}), 14000);
  const lang = body.lang === 'mr' ? 'mr' : 'en';
  const farmMessage = `FARM_DATA: ${farm}\nlanguage: ${lang}\n\nQuestion: ${message}`;

  try {
    return geminiKey ? await callGemini(geminiKey, env, farmMessage, history) : await callClaude(claudeKey, env, farmMessage, history);
  } catch (e) {
    return { status: 502, json: { error: 'network', detail: clip(e && e.message, 200) } };
  }
}

module.exports = { handleChat };
