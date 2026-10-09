import { getLocalRayaReply } from './rayaLocal';

function uniqueBases() {
  const out = [];
  const add = (b) => {
    if (!b) return;
    const s = String(b).replace(/\/$/, '');
    if (!out.includes(s)) out.push(s);
  };

  add(import.meta.env.VITE_CHAT_API_BASE);
  if (import.meta.env.DEV) {
    add('http://127.0.0.1:8001');
    add('http://localhost:8001');
  }
  add('http://127.0.0.1:8001');

  return out;
}

/**
 * Tries Guardian GEE `/api/chat` on known bases; falls back to local Raya so the UI always works.
 */
export async function fetchRayaReply(message, history, lang) {
  const bases = uniqueBases();

  for (const base of bases) {
    const url = `${base}/api/chat`;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12000);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ message, history: history || [] }),
        signal: ctrl.signal,
      });
      clearTimeout(timer);
      if (!res.ok) continue;
      const data = await res.json().catch(() => null);
      const reply = data?.reply;
      if (typeof reply === 'string' && reply.trim()) return reply.trim();
    } catch {
      /* try next base */
    }
  }

  return getLocalRayaReply(message, lang);
}
