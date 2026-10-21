import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import { ingestV4, ITEM_HEADERS, OVERLAP_HEADERS, SAFETY_HEADERS, SOURCE_HEADERS } from './ingest-v4.js';
import { buildCatalogView } from './view.js';
import { coverageLine } from './validate-v4.js';
import data from '../../../data/catalog.json' with { type: 'json' };
import { catalogSchema } from './schema.js';

type Row = Record<string, unknown>;
const creatine: Row = {
  key: 'creatine-monohydrate',
  name: 'Creatine monohydrate',
  short_name: 'Creatine',
  area: 'eat',
  also_serves: 'move',
  kind: 'supplement',
  moments: 'morning, any',
  cadence: 'daily',
  ritual_role: 'companion',
  cost_month_usd: 14,
  how_common: 4,
  comes_from: 'podcast, gym',
  why_loved: 'confidence',
  evidence_tier: 'A',
  evidence_for: 'strength and muscle in people who train',
  evidence_requires: 'trains',
  tier_otherwise: 'C',
  evidence_summary: 'One of the best-supported supplements for strength in people who train.',
  sources: 'kreider-2017',
  dose_min: 3,
  dose_typical: '3 to 5',
  dose_unit: 'g',
  studied_forms: 'monohydrate',
  keep_when: 'THEIRS, LOVED, EVIDENCE_REGULAR, TRAINS',
  clear_when: 'DOSE_BELOW_MIN, NOT_TRAINING',
  never_clear: 'no',
  human_question: 'Do you lift, or is it more for focus?',
  fits_instead: '',
  awe: '',
  wearable_sees: 'no',
  overlaps: '',
  top50: 'yes',
  status: 'live',
  reviewed_by: 'Ishan',
  reviewed_on: '2026-10-21',
  notes_internal: '',
};
const source: Row = {
  id: 'kreider-2017',
  citation: 'Kreider RB et al. ISSN position stand: creatine. JISSN.',
  year: 2017,
  type: 'position stand',
  doi_or_url: 'https://doi.org/10.1186/s12970-017-0173-z',
  finding: 'Creatine monohydrate supports training adaptations and is safe in healthy adults.',
  population: 'adults who train',
  checked_by: 'Claude (abstract)',
  checked_on: '2026-10-20',
};

function workbook(items: Row[], sources: Row[] = [source], overlaps: Row[] = [], safety: Row[] = []) {
  const wb = XLSX.utils.book_new();
  const add = (name: string, headers: readonly string[], rows: Row[]) =>
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[...headers], ...rows.map((r) => headers.map((h) => r[h] ?? null))]), name);
  // Columns in a different order than the code lists them: the build reads by header.
  add('Items', [...ITEM_HEADERS].reverse(), items);
  add('Sources', SOURCE_HEADERS, sources);
  add('Overlaps', OVERLAP_HEADERS, overlaps);
  add('Safety', SAFETY_HEADERS, safety);
  add('Words', ['phrase'], [{ phrase: 'should' }, { phrase: 'boost' }]);
  return wb;
}

describe('routing table V4', () => {
  it('reads rows by header, wherever the columns are, and attaches safety rows to items', () => {
    const c = ingestV4(
      workbook([creatine], [source], [], [{ item: 'creatine-monohydrate', condition: 'kidney-disease', action: 'clinician-first', note: 'With kidney disease, check with your clinician first.' }]),
      'a'.repeat(64),
    );
    expect(c.items[0]!.moments).toEqual(['morning', 'any']);
    expect(c.items[0]!.safety).toEqual([{ condition: 'kidney-disease', action: 'clinician-first', note: 'With kidney disease, check with your clinician first.' }]);
    expect(c.coverage).toEqual({ live: 1, reviewed: 0, draft: 0, top50Live: 1, top50Total: 1 });
  });
  it('names the sheet, row and column of every problem', () => {
    const bad = { ...creatine, sources: '', human_question: 'You should lift, it will boost everything!' };
    expect(() => ingestV4(workbook([bad]), 'a'.repeat(64))).toThrow(/Items row 2, column sources: tier A needs at least one source someone checked/);
    try {
      ingestV4(workbook([bad]), 'a'.repeat(64));
    } catch (e) {
      const message = String(e);
      expect(message).toMatch(/column human_question: uses "should"/);
      expect(message).toMatch(/column human_question: uses "boost"/);
      expect(message).toMatch(/exclamation/);
    }
  });
  it('needs a reviewer before a row goes live, and a source someone checked for A and B', () => {
    expect(() => ingestV4(workbook([{ ...creatine, reviewed_by: '' }]), 'a'.repeat(64))).toThrow(/live row needs reviewed_by/);
    expect(() => ingestV4(workbook([creatine], [{ ...source, checked_by: '', checked_on: '' }]), 'a'.repeat(64))).toThrow(/someone checked/);
  });
  it('only lets reviewed rows reach the engine; everything else reads as unknown evidence', () => {
    const v3 = catalogSchema.parse(data);
    const draft = ingestV4(workbook([{ ...creatine, status: 'draft', reviewed_by: '', reviewed_on: '' }]), 'a'.repeat(64));
    const production = buildCatalogView(draft, v3, { statuses: ['live'] });
    expect(production.item('creatine-monohydrate')!.tier).toBe('U');
    expect(production.item('creatine-monohydrate')!.origin).toBe('v3');
    const live = buildCatalogView(ingestV4(workbook([creatine]), 'a'.repeat(64)), v3);
    expect(live.item('creatine-monohydrate')!.tier).toBe('A');
    expect(live.item('creatine-monohydrate')!.evidenceDirection).toBe('benefit');
    expect(coverageLine(ingestV4(workbook([creatine]), 'a'.repeat(64)), v3.items.length)).toBe('V4: 1 live of 1 top, 0 reviewed, 0 draft, 209 on V3');
  });
});
