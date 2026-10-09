/** GEE analyze microservice (see gee_service/). Set VITE_GEE_API_BASE on Vercel when backend is deployed. */
export function getGeeAnalyzeUrl() {
  const base = import.meta.env.VITE_GEE_API_BASE;
  if (base) return `${String(base).replace(/\/$/, '')}/api/analyze`;
  if (import.meta.env.DEV) return 'http://localhost:8001/api/analyze';
  return '';
}
