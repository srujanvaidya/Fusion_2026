/**
 * The old demo claim (Drought, Plot No 101, Akaichiwadi, Satara) is hidden from the insurance views.
 * Only records created before CUTOFF are hidden, so a new claim for the same plot still shows.
 * The Firestore document itself is untouched.
 */
const CUTOFF_SECONDS = Date.UTC(2026, 9, 9) / 1000; // 9 Oct 2026

export const isHiddenClaim = (c) => {
  const samePlot = String(c?.gatNumber ?? c?.gutNo ?? '').trim() === '101' && String(c?.village || '').includes('अकाईचीवाडी');
  const created = c?.createdAt?.seconds; // missing while a fresh write is still pending -> treat as new
  return samePlot && created != null && created < CUTOFF_SECONDS;
};

export const visibleClaims = (rows) => rows.filter((c) => !isHiddenClaim(c));
