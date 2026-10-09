/**
 * Ask the server-side language model (POST /api/chat) with the farm's data as context.
 * Resolves to the reply text, or null when the model is not configured or unreachable
 * so the caller can fall back to the rule-based answer.
 */
let disabledUntil = 0;

export async function askRayaLLM({ message, history, context, lang }) {
  if (Date.now() < disabledUntil || !context) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 45000);
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history, context, lang }),
      signal: ctrl.signal,
    });
    if (res.status === 501 || res.status === 404 || res.status === 405) { disabledUntil = Date.now() + 5 * 60000; return null; }
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.reply === 'string' && data.reply.trim() ? data.reply.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
