/** Stable key for "same" offer across AI runs / emails (not the stored id). */
export function offerDedupeKey(o) {
  if (!o || typeof o !== 'object') return '';
  const norm = (s) =>
    (s || '')
      .toString()
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  const m = norm(o.merchant);
  const c = norm(o.cardName);
  const d = norm(o.discount);
  const v = (o.validUntil || '').toString().trim();
  const p = norm(o.promoCode);
  return `${m}::${c}::${d}::${v}::${p}`;
}

/** Keep first occurrence per dedupe key. */
export function dedupeOffersByKey(offers) {
  const seen = new Set();
  const out = [];
  for (const o of offers || []) {
    if (!o || typeof o !== 'object') continue;
    const k = offerDedupeKey(o);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(o);
  }
  return out;
}

export function stripOfferReviewMeta(o) {
  if (!o || typeof o !== 'object') return o;
  const { _rid, ...rest } = o;
  return rest;
}

/** Assign per-session row ids for checkbox selection in Email Sync. */
export function withReviewIds(offers) {
  const t = Date.now();
  return (offers || []).map((o, i) => ({
    ...o,
    _rid: o._rid || `r_${t}_${i}_${Math.random().toString(36).slice(2)}`,
  }));
}
