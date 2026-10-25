import { z } from 'zod';
import { catalogV4Schema, type CatalogV4 } from './schema-v4.js';

/**
 * Every rule in docs/ROUTING-V4.md that a machine can check. Any failure stops `pnpm check` with the
 * sheet, the row and the column. The engine only ever reads a row that passed all of these.
 */

export class V4ValidationError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(`Routing table V4 has ${problems.length} problem(s):\n- ${problems.join('\n- ')}`);
  }
}

/** Mechanical tone checks for words a person can read (the full lint runs again in pnpm tone-lint). */
export function personTextProblems(textIn: string, banned: readonly string[], maxWords: number): string[] {
  const problems: string[] = [];
  const t = textIn.normalize('NFKC').toLowerCase().replace(/[’‘]/g, "'");
  for (const phrase of banned) {
    const pattern = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`\\b${pattern}\\b`, 'i').test(t)) problems.push(`uses "${phrase}"`);
  }
  if (textIn.includes('!')) problems.push('has an exclamation mark');
  if (/\b(they|their|the user|the person)\b/i.test(t)) problems.push('talks about the person instead of to them');
  const words = textIn.trim().split(/\s+/).filter(Boolean).length;
  if (words > maxWords) problems.push(`${words} words, more than ${maxWords}`);
  return problems;
}

const formatIssue = (issue: z.core.$ZodIssue, input: unknown) => {
  const path = issue.path;
  const [table, index, field] = path as [string, number, string];
  const rows = (input as Record<string, { source?: { sheet: string; row: number } }[]>)[table];
  const where = rows?.[index]?.source;
  return where
    ? `${where.sheet} row ${where.row}, column ${String(field ?? '')}: ${issue.message}`
    : `${path.join('.')}: ${issue.message}`;
};

/** The engine's own list of words that mean "a thing to buy" (validate.ts): a swap never adds one. */
const BUY_WORDS =
  /\b(supplement|capsules?|gummies|gummy|pills?|tablets?|powder|serum|cream|mask|patch|drops?|tincture|shake|bar|subscription|membership|device|tracker|ring|app)\b/i;

export function validateV4(input: unknown): CatalogV4 {
  const parsed = catalogV4Schema.safeParse(input);
  if (!parsed.success) throw new V4ValidationError(parsed.error.issues.map((i) => formatIssue(i, input)));
  const c = parsed.data;
  const problems: string[] = [];
  const at = (sheet: string, row: number, column: string) => `${sheet} row ${row}, column ${column}`;

  const keys = new Set<string>();
  for (const i of c.items) {
    if (keys.has(i.key)) problems.push(`${at('Items', i.source.row, 'key')}: duplicate key ${i.key}`);
    keys.add(i.key);
  }
  const sourceIds = new Map(c.sources.map((s) => [s.id, s]));
  if (sourceIds.size !== c.sources.length) problems.push('Sources: duplicate id');
  const groups = new Set(c.overlaps.map((o) => o.group));
  if (groups.size !== c.overlaps.length) problems.push('Overlaps: duplicate group');

  for (const i of c.items) {
    const r = i.source.row;
    // Brand-funded work counts as no independent evidence, so it never carries a tier A or B.
    const checked = i.sources
      .map((id) => sourceIds.get(id))
      .filter((s) => s && s.checkedOn && s.checkedBy && !s.brandFunded);
    for (const id of i.sources)
      if (!sourceIds.has(id)) problems.push(`${at('Items', r, 'sources')}: no source "${id}" on the Sources sheet`);
    if ((i.evidenceTier === 'A' || i.evidenceTier === 'B') && !checked.length)
      problems.push(`${at('Items', r, 'sources')}: tier ${i.evidenceTier} needs at least one independent source someone checked`);
    if (i.evidenceTier === 'C' && !i.sources.length)
      problems.push(`${at('Items', r, 'sources')}: tier C needs at least one source`);
    if (i.kind === 'supplement' && (i.evidenceTier === 'A' || i.evidenceTier === 'B') && (i.doseMin === null || i.doseUnit === null))
      problems.push(`${at('Items', r, 'dose_min')}: a tier ${i.evidenceTier} supplement needs dose_min and dose_unit`);
    if (i.evidenceRequires !== 'none' && i.tierOtherwise === null)
      problems.push(`${at('Items', r, 'tier_otherwise')}: evidence_requires is ${i.evidenceRequires}, so give the tier for everyone else`);
    if (i.status === 'live' && (!i.reviewedBy || !i.reviewedOn))
      problems.push(`${at('Items', r, 'reviewed_by')}: a live row needs reviewed_by and reviewed_on`);
    if (!i.keepWhen.includes('THEIRS') || !i.keepWhen.includes('LOVED'))
      problems.push(`${at('Items', r, 'keep_when')}: THEIRS and LOVED always keep`);
    if (i.neverClear && i.clearWhen.length)
      problems.push(`${at('Items', r, 'clear_when')}: never_clear is yes, so there can be no clear codes`);
    // A row strong only for some people (creatine for people who train) can be weak for the rest.
    const weak = (t: string | null) => t === 'C' || t === 'D' || t === 'N';
    if (i.clearWhen.includes('BORROWED_WEAK') && !weak(i.evidenceTier) && !weak(i.tierOtherwise))
      problems.push(`${at('Items', r, 'clear_when')}: BORROWED_WEAK is for tiers C, D and N (here or in tier_otherwise)`);
    if (i.clearWhen.includes('OVERLAP') && !i.overlaps.length)
      problems.push(`${at('Items', r, 'overlaps')}: OVERLAP needs at least one overlap group`);
    for (const g of i.overlaps)
      if (!groups.has(g)) problems.push(`${at('Items', r, 'overlaps')}: no group "${g}" on the Overlaps sheet`);
    if (i.swap && !i.fitsInstead)
      problems.push(`${at('Items', r, 'swap_title')}: a swap needs the fits_instead line that explains it`);
    if (i.swap && BUY_WORDS.test(i.swap.title))
      problems.push(`${at('Items', r, 'swap_title')}: a swap is something to do, never something to buy`);
    for (const [field, value, max] of [
      ['swap_title', i.swap?.title ?? '', 8],
      ['evidence_summary', i.evidenceSummary, 40],
      ['human_question', i.humanQuestion, 11],
      ['origin_question', i.originQuestion, 14],
      ['fits_instead', i.fitsInstead, 30],
    ] as const)
      if (value) for (const p of personTextProblems(value, c.bannedPhrases, max)) problems.push(`${at('Items', r, field)}: ${p}`);
  }
  for (const s of c.sources) {
    const words = s.finding.split(/\s+/).filter(Boolean).length;
    if (words > 30) problems.push(`${at('Sources', s.source.row, 'finding')}: ${words} words, more than 30`);
    if (!!s.checkedBy !== !!s.checkedOn)
      problems.push(`${at('Sources', s.source.row, 'checked_on')}: checked_by and checked_on go together`);
  }
  for (const o of c.overlaps)
    for (const m of o.members)
      if (!keys.has(m) && !/^[a-z0-9-]+$/.test(m))
        problems.push(`${at('Overlaps', o.source.row, 'members')}: "${m}" isn't a key`);
  for (const s of c.safety) {
    if (!keys.has(s.item)) problems.push(`${at('Safety', s.source.row, 'item')}: no item "${s.item}"`);
    if (s.note) for (const p of personTextProblems(s.note, c.bannedPhrases, 30)) problems.push(`${at('Safety', s.source.row, 'note')}: ${p}`);
  }
  if (problems.length) throw new V4ValidationError(problems);
  return c;
}

/** "V4: 50 live of 50 top, 12 draft, 148 on V3" */
export function coverageLine(c: CatalogV4, v3Count: number): string {
  const v4Keys = new Set(c.items.filter((i) => i.status === 'live').map((i) => i.key));
  return `V4: ${c.coverage.top50Live} live of ${c.coverage.top50Total} top, ${c.coverage.reviewed} reviewed, ${c.coverage.draft} draft, ${Math.max(0, v3Count - v4Keys.size)} on V3`;
}
