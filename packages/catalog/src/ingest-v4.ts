import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import type { CatalogV4 } from './schema-v4.js';
import { validateV4 } from './validate-v4.js';

/**
 * Reads data/Routing-Table_V4.xlsx into catalog-v4.json. Columns are found by their header text,
 * not their letter, so they can move without breaking the build. Every problem names the sheet,
 * the row and the column.
 */

export const V4_SHEETS = ['Items', 'Sources', 'Overlaps', 'Safety', 'Words'] as const;

export const ITEM_HEADERS = [
  'key',
  'name',
  'short_name',
  'area',
  'also_serves',
  'kind',
  'moments',
  'cadence',
  'ritual_role',
  'cost_month_usd',
  'how_common',
  'comes_from',
  'why_loved',
  'evidence_tier',
  'evidence_for',
  'evidence_requires',
  'tier_otherwise',
  'evidence_summary',
  'sources',
  'dose_min',
  'dose_typical',
  'dose_unit',
  'studied_forms',
  'keep_when',
  'clear_when',
  'never_clear',
  'human_question',
  'origin_question',
  'fits_instead',
  'awe',
  'wearable_sees',
  'overlaps',
  'top50',
  'status',
  'reviewed_by',
  'reviewed_on',
  'notes_internal',
] as const;
export const SOURCE_HEADERS = [
  'id',
  'citation',
  'year',
  'type',
  'doi_or_url',
  'finding',
  'population',
  'checked_by',
  'checked_on',
  'brand_funded',
] as const;
export const OVERLAP_HEADERS = ['group', 'members', 'rule', 'note'] as const;
export const SAFETY_HEADERS = ['item', 'condition', 'action', 'note'] as const;
export const WORD_HEADERS = ['phrase'] as const;

type Cell = string | number | boolean | null;

export class V4SheetError extends Error {}

function table(wb: XLSX.WorkBook, sheet: string, headers: readonly string[]) {
  const ws = wb.Sheets[sheet];
  if (!ws) throw new V4SheetError(`Missing sheet: ${sheet}`);
  const grid = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: false });
  const head = (grid[0] ?? []).map((h) => (typeof h === 'string' ? h.trim() : h));
  const index = new Map<string, number>();
  head.forEach((h, i) => {
    if (typeof h === 'string' && h) index.set(h, i);
  });
  for (const h of headers)
    if (!index.has(h)) throw new V4SheetError(`${sheet}: missing column "${h}" in the header row`);
  const rows: { row: number; get: (h: string) => Cell }[] = [];
  grid.slice(1).forEach((cells, i) => {
    const empty = cells.every((c) => c === null || (typeof c === 'string' && !c.trim()));
    if (empty) return;
    rows.push({ row: i + 2, get: (h) => cells[index.get(h)!] ?? null });
  });
  return rows;
}

const text = (v: Cell) => (v === null ? '' : String(v).trim());
const list = (v: Cell) =>
  text(v)
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
const number = (v: Cell, where: string): number | null => {
  if (v === null || text(v) === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(/[$,]/g, ''));
  if (!Number.isFinite(n)) throw new V4SheetError(`${where}: expected a number, got ${JSON.stringify(v)}`);
  return n;
};
const yesNo = (v: Cell, where: string): boolean => {
  const t = text(v).toLowerCase();
  if (t === 'yes' || v === true) return true;
  if (t === 'no' || t === '' || v === false) return false;
  throw new V4SheetError(`${where}: expected yes or no, got ${JSON.stringify(v)}`);
};
const orNull = (v: Cell) => (text(v) === '' ? null : text(v));

export function ingestV4(wb: XLSX.WorkBook, sourceSha256: string): CatalogV4 {
  const items = table(wb, 'Items', ITEM_HEADERS).map(({ row, get }) => {
    const at = (h: string) => `Items row ${row}, column ${h}`;
    return {
      key: text(get('key')),
      name: text(get('name')),
      shortName: text(get('short_name')),
      area: text(get('area')),
      alsoServes: list(get('also_serves')),
      kind: text(get('kind')),
      moments: list(get('moments')),
      cadence: text(get('cadence')),
      ritualRole: text(get('ritual_role')),
      costMonthUsd: number(get('cost_month_usd'), at('cost_month_usd')) ?? 0,
      howCommon: number(get('how_common'), at('how_common')) ?? 0,
      comesFrom: list(get('comes_from')),
      whyLoved: list(get('why_loved')),
      evidenceTier: text(get('evidence_tier')),
      evidenceFor: text(get('evidence_for')),
      evidenceRequires: text(get('evidence_requires')) || 'none',
      tierOtherwise: orNull(get('tier_otherwise')),
      evidenceSummary: text(get('evidence_summary')),
      sources: list(get('sources')),
      doseMin: number(get('dose_min'), at('dose_min')),
      doseTypical: text(get('dose_typical')),
      doseUnit: orNull(get('dose_unit')),
      studiedForms: list(get('studied_forms')),
      keepWhen: list(get('keep_when')),
      clearWhen: list(get('clear_when')),
      neverClear: yesNo(get('never_clear'), at('never_clear')),
      humanQuestion: text(get('human_question')),
      originQuestion: text(get('origin_question')),
      fitsInstead: text(get('fits_instead')),
      awe: orNull(get('awe')),
      wearableSees: text(get('wearable_sees')),
      overlaps: list(get('overlaps')),
      top50: yesNo(get('top50'), at('top50')),
      status: text(get('status')) || 'draft',
      reviewedBy: text(get('reviewed_by')),
      reviewedOn: text(get('reviewed_on')),
      notesInternal: text(get('notes_internal')),
      safety: [] as { condition: string; action: string; note: string }[],
      source: { sheet: 'Items', row },
    };
  });
  const sources = table(wb, 'Sources', SOURCE_HEADERS).map(({ row, get }) => ({
    id: text(get('id')),
    citation: text(get('citation')),
    year: number(get('year'), `Sources row ${row}, column year`),
    type: text(get('type')),
    doiOrUrl: text(get('doi_or_url')),
    finding: text(get('finding')),
    population: text(get('population')),
    checkedBy: text(get('checked_by')),
    checkedOn: text(get('checked_on')),
    brandFunded: yesNo(get('brand_funded'), `Sources row ${row}, column brand_funded`),
    source: { sheet: 'Sources', row },
  }));
  const overlaps = table(wb, 'Overlaps', OVERLAP_HEADERS).map(({ row, get }) => ({
    group: text(get('group')),
    members: list(get('members')),
    rule: text(get('rule')),
    note: text(get('note')),
    source: { sheet: 'Overlaps', row },
  }));
  const safety = table(wb, 'Safety', SAFETY_HEADERS).map(({ row, get }) => ({
    item: text(get('item')),
    condition: text(get('condition')),
    action: text(get('action')),
    note: text(get('note')),
    source: { sheet: 'Safety', row },
  }));
  const bannedPhrases = table(wb, 'Words', WORD_HEADERS).map(({ get }) => text(get('phrase')));
  // Each item carries its own safety rows, so the engine reads them in one place.
  for (const s of safety) {
    const item = items.find((i) => i.key === s.item);
    if (item) item.safety.push({ condition: s.condition, action: s.action, note: s.note });
  }
  const live = items.filter((i) => i.status === 'live').length;
  const reviewed = items.filter((i) => i.status === 'reviewed').length;
  const draft = items.filter((i) => i.status === 'draft').length;
  return validateV4({
    schemaVersion: 4,
    sourceFile: 'Routing-Table_V4.xlsx',
    sourceSha256,
    items,
    sources,
    overlaps,
    safety,
    bannedPhrases,
    coverage: {
      live,
      reviewed,
      draft,
      top50Live: items.filter((i) => i.top50 && i.status === 'live').length,
      top50Total: items.filter((i) => i.top50).length,
    },
  });
}

export function readCatalogV4(path: string): CatalogV4 {
  const bytes = readFileSync(path);
  return ingestV4(
    XLSX.read(bytes, { type: 'buffer' }),
    createHash('sha256').update(bytes).digest('hex'),
  );
}
