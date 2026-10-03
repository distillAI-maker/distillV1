/** Client-safe fuzzy matching over the slim catalog index. No dependencies. */

export interface IndexEntry {
  key: string;
  name: string;
  category: string;
  kind: 'buy' | 'do' | 'environment';
  cost: number;
  aliases: string[];
}

export function normalise(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/** Aliases derived from a catalog name: the part before a parenthesis, and the parts inside it. */
export function deriveAliases(name: string): string[] {
  const out = new Set<string>();
  const base = name.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  if (base && base !== name) out.add(base);
  for (const part of base.split(/\s*\/\s*/)) if (part !== base) out.add(part.trim());
  const inner = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => m[1] ?? '');
  for (const group of inner) {
    for (const raw of group.split(/\s*(?:,|\/|\bor\b|\betc\.?)\s*/)) {
      const part = raw.replace(/\betc\.?$/, '').trim();
      // Brand-like parts only: "Calm", "AG1", "KSM-66". Plain words such as "monthly" are noise.
      if (part && /[A-Z0-9]/.test(part)) out.add(part);
    }
  }
  return [...out].filter((a) => {
    const n = normalise(a);
    return n.length >= 4 || /\d/.test(a) || a === a.toUpperCase();
  });
}

function levenshtein(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const v = Math.min((prev[j] ?? 0) + 1, (cur[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost);
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return max + 1;
    prev = cur;
  }
  return prev[b.length] ?? max + 1;
}

function isSubsequence(q: string, s: string): boolean {
  let i = 0;
  for (const ch of s) if (ch === q[i]) i++;
  return i === q.length;
}

function scoreCandidate(q: string, qTokens: string[], cand: string): number {
  if (cand === q) return 100;
  if (cand.startsWith(q)) return 90 - Math.min(9, (cand.length - q.length) * 0.2);
  const cTokens = cand.split(' ');
  if (qTokens.every((t) => cTokens.some((c) => c.startsWith(t))))
    return 78 - Math.min(8, cTokens.length);
  if (cand.includes(q)) return 65;
  const fuzzy = qTokens.every((t) => {
    const max = t.length <= 4 ? 1 : 2;
    return cTokens.some((c) => levenshtein(t, c, max) <= max || (t.length >= 5 && c.startsWith(t.slice(0, -1))));
  });
  if (fuzzy && qTokens.some((t) => t.length >= 4)) return 55;
  if (q.length >= 4 && cTokens.some((c) => isSubsequence(q, c))) return 40;
  return 0;
}

export function scoreEntry(query: string, entry: IndexEntry): number {
  const q = normalise(query);
  if (!q) return 0;
  const qTokens = q.split(' ');
  let best = 0;
  const candidates = [entry.name, ...entry.aliases];
  for (const c of candidates) {
    const s = scoreCandidate(q, qTokens, normalise(c));
    if (s > best) best = s;
  }
  return best;
}

export function search(query: string, entries: IndexEntry[], limit = 8): IndexEntry[] {
  const q = normalise(query);
  if (q.length < 2) return [];
  return entries
    .map((e) => ({ e, s: scoreEntry(q, e) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.e.name.length - b.e.name.length || a.e.name.localeCompare(b.e.name))
    .slice(0, limit)
    .map((x) => x.e);
}

/** Catalog entries whose name or an alias appears as whole words in free text, in order of appearance. */
export function matchText(text: string, entries: IndexEntry[]): IndexEntry[] {
  const t = ` ${normalise(text)} `;
  if (t.trim().length < 3) return [];
  const hits: { e: IndexEntry; at: number }[] = [];
  for (const e of entries) {
    let at = -1;
    for (const c of [e.name, ...e.aliases]) {
      const n = normalise(c);
      if (n.length < 3) continue;
      const i = t.indexOf(` ${n} `);
      if (i >= 0 && (at < 0 || i < at)) at = i;
    }
    if (at >= 0) hits.push({ e, at });
  }
  return hits.sort((a, b) => a.at - b.at).map((h) => h.e);
}
