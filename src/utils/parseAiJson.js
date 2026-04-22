/**
 * Extract a JSON array of offers from LLM output (handles markdown fences, prose, wrappers).
 * @returns {{ ok: boolean, parsed: unknown[], error?: string }}
 */
export function parseOfferJsonArrayFromText(raw) {
  if (raw == null) return { ok: false, parsed: [], error: 'empty' };
  let s = String(raw).trim();
  if (!s) return { ok: false, parsed: [], error: 'empty' };

  const candidates = [];
  for (const m of s.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) {
    const inner = m[1].trim();
    if (inner) candidates.push(inner);
  }
  s = s.replace(/```(?:json)?\s*[\s\S]*?```/gi, ' ').replace(/\s+/g, ' ').trim();
  if (s) candidates.push(s);
  const extracted = extractBalancedJsonArray(s);
  if (extracted) candidates.push(extracted);

  for (const c of candidates) {
    const t = c.trim();
    if (!t) continue;
    try {
      const v = JSON.parse(t);
      if (Array.isArray(v)) return { ok: true, parsed: v, error: undefined };
      if (v && typeof v === 'object') {
        if (Array.isArray(v.offers)) return { ok: true, parsed: v.offers, error: undefined };
        if (Array.isArray(v.results)) return { ok: true, parsed: v.results, error: undefined };
        if (Array.isArray(v.data)) return { ok: true, parsed: v.data, error: undefined };
        if (v.discount != null || v.merchant != null || v.cardName != null) {
          return { ok: true, parsed: [v], error: undefined };
        }
      }
    } catch {
      // try next candidate
    }
  }

  return { ok: false, parsed: [], error: 'not_json' };
}

/** First top-level [...] balanced for strings and escapes. */
function extractBalancedJsonArray(str) {
  const start = str.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let esc = false;
  for (let i = start; i < str.length; i++) {
    const c = str[i];
    if (esc) {
      esc = false;
      continue;
    }
    if (c === '\\' && inString) {
      esc = true;
      continue;
    }
    if (c === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return str.slice(start, i + 1);
    }
  }
  return null;
}
