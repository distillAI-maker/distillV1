import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as XLSX from 'xlsx';
import { describe, expect, it } from 'vitest';
import { ingestWorkbook, readCatalog, REQUIRED_SHEETS } from './ingest.js';
import { validateCatalog } from './validate.js';
import type { Catalog } from './schema.js';

const path = fileURLToPath(new URL('../../../data/Routing-Table_V3.xlsx', import.meta.url));
const catalog = readCatalog(path);
const bytes = readFileSync(path);
function changedCell(sheet: string, address: string, value: unknown) {
  const wb = XLSX.read(bytes, { type: 'buffer', cellFormula: true });
  wb.Sheets[sheet]![address] = { ...wb.Sheets[sheet]![address], v: value };
  return wb;
}
function changedCatalog(change: (c: Catalog) => void) {
  const c = structuredClone(catalog);
  change(c);
  return c;
}

describe('V3 workbook contract', () => {
  it('reads all thirteen sheets and preserves narrative cells and cached formulas', () => {
    expect(Object.keys(catalog.sheets)).toEqual([...REQUIRED_SHEETS]);
    expect(catalog.sheets['Start Here']!['A9']!.value).toBe('What changed in version 4');
    expect(catalog.sheets.Items!.G2!.formula).toBeTruthy();
    expect(catalog.sheets['Worked Example']!.C27!.value).toBe(1428);
    expect(catalog.sheets['Emotional Positioning']!.A30!.value).toBe('The scoreboard goes down');
  });
  it('reproduces the supplied acceptance counts and carries all fact-check flags', () => {
    expect(catalog.items).toHaveLength(210);
    expect(catalog.summary.tiers).toEqual({
      T1: 16,
      T1_QUEUED_SLOW: 3,
      T1_QUEUED_SPECIAL: 1,
      T3_TOO_SMALL: 61,
      T2: 47,
      T3: 73,
      PROTECTED: 9,
    });
    expect(catalog.items.filter((i) => i.unverified)).toHaveLength(93);
    expect(catalog.items.filter((i) => i.onDays === 'observe')).toHaveLength(9);
    expect(catalog.items.filter((i) => i.tier === 'T2').every((i) => i.unverified)).toBe(true);
  });
  it('retains zero effects separately from absent estimates', () => {
    expect(catalog.items.find((i) => i.key === 'gaba-oral')?.expectedEffect).toBe(0);
    expect(catalog.items.find((i) => i.key === 'vitamin-d3')?.expectedEffect).toBeNull();
    expect(catalog.items.find((i) => i.key === 'coffee-after-2pm')?.monthlyCost).toBe(0);
  });
  it('resolves commas inside item names without dropping group members', () => {
    expect(catalog.overlapGroups).toHaveLength(18);
    expect(catalog.overlapGroups.find((g) => g.name === 'sleep aids')?.itemKeys).toContain(
      'lavender-oil-oral-silexan',
    );
    expect(catalog.overlapGroups.find((g) => g.name === 'fitness memberships')?.itemKeys).toContain(
      'boutique-class-membership-barry-s-soulcycle-f45-orangetheory',
    );
    expect(catalog.followUpQuestions).toHaveLength(8);
    expect(catalog.followUpQuestions.flatMap((q) => q.itemKeys)).toHaveLength(210);
  });
  it('preserves metric caveats, goal rating choices, placeholders and source copy', () => {
    expect(catalog.metrics).toHaveLength(12);
    expect(catalog.goals).toHaveLength(16);
    expect(catalog.metrics.find((m) => m.name === 'Overnight HRV')?.availability.apple).toBe(
      'spot checks only',
    );
    expect(catalog.goals.find((g) => g.name === 'focus / memory')).toMatchObject({
      metricText: null,
      dailyRating: true,
    });
    expect(
      catalog.verdictTemplates.find((t) => t.name.includes('hypothesis'))?.placeholders,
    ).toContain('did it');
  });
  it('is deterministic and matches the committed JSON exactly', () => {
    expect(readCatalog(path)).toEqual(catalog);
    expect(
      readFileSync(fileURLToPath(new URL('../../../data/catalog.json', import.meta.url)), 'utf8'),
    ).toBe(JSON.stringify(catalog, null, 2) + '\n');
  });
});

describe('invalid workbooks fail loudly', () => {
  it('rejects duplicate stable keys', () =>
    expect(() =>
      validateCatalog(
        changedCatalog((c) => {
          c.items[1]!.key = c.items[0]!.key;
        }),
      ),
    ).toThrow('Duplicate key'));
  it.each([
    ['U2', 'new tier'],
    ['M2', 'medium: sometimes'],
    ['AD2', 'mystery'],
    ['W2', 'maybe assign'],
  ])('rejects unknown normalized enum at %s', (cell, value) => {
    expect(() => ingestWorkbook(changedCell('Items', cell!, value), '0'.repeat(64))).toThrow(
      'unknown enum',
    );
  });
  it.each(['kind', 'category', 'visibility', 'chance', 'evidenceGrade', 'mechanism'])(
    'rejects unknown %s',
    (field) => {
      const c = structuredClone(catalog);
      Object.assign(c.items[0]!, { [field]: 'unknown' });
      expect(() => validateCatalog(c)).toThrow();
    },
  );
  it('rejects invalid numbers rather than coercing missing or text to zero', () => {
    expect(() => ingestWorkbook(changedCell('Items', 'P2', '0.3-ish'), '0'.repeat(64))).toThrow(
      'finite number',
    );
    expect(() => ingestWorkbook(changedCell('Items', 'F2', null), '0'.repeat(64))).toThrow(
      'finite number',
    );
  });
  it('rejects unknown names in overlap groups', () =>
    expect(() =>
      ingestWorkbook(changedCell('Overlap Groups', 'C5', 'Imaginary item'), '0'.repeat(64)),
    ).toThrow('unknown item name'));
  it('rejects unknown keys in normalized overlap groups', () =>
    expect(() =>
      validateCatalog(
        changedCatalog((c) => {
          c.overlapGroups[0]!.itemKeys[0] = 'missing';
        }),
      ),
    ).toThrow('unknown item'));
  it('rejects unknown placeholders', () =>
    expect(() =>
      ingestWorkbook(changedCell('Verdict Templates', 'B2', '{item}: {mystery}'), '0'.repeat(64)),
    ).toThrow('unknown placeholder'));
  it('rejects malformed placeholders', () =>
    expect(() =>
      ingestWorkbook(changedCell('Verdict Templates', 'B2', '{item}: {number'), '0'.repeat(64)),
    ).toThrow('Malformed placeholder'));
  it('compares tier counts with Summary rather than hardcoding around changed data', () =>
    expect(() => ingestWorkbook(changedCell('Summary', 'B11', 17), '0'.repeat(64))).toThrow(
      'Tier T1: expected 17 from Summary, received 16',
    ));
  it('rejects a T2 row without a reason', () =>
    expect(() =>
      validateCatalog(
        changedCatalog((c) => {
          c.items.find((i) => i.tier === 'T2')!.dropReason = null;
        }),
      ),
    ).toThrow('T2 row has no reason'));
  it('rejects missing sheets and moved item headers', () => {
    const wb = XLSX.read(bytes, { type: 'buffer' });
    delete wb.Sheets['Tone Guide'];
    expect(() => ingestWorkbook(wb, '0'.repeat(64))).toThrow('Missing sheet');
    expect(() => ingestWorkbook(changedCell('Items', 'J1', 'Renamed'), '0'.repeat(64))).toThrow(
      'expected header',
    );
  });
  it('rejects stale or absent annual cost caches and spreadsheet errors', () => {
    expect(() => ingestWorkbook(changedCell('Items', 'G2', 1), '0'.repeat(64))).toThrow(
      'stale annual cost',
    );
    expect(() => ingestWorkbook(changedCell('Items', 'G2', undefined), '0'.repeat(64))).toThrow(
      'formula has no cached value',
    );
    const wb = changedCell('Items', 'G2', 23);
    wb.Sheets.Items!.G2!.t = 'e';
    expect(() => ingestWorkbook(wb, '0'.repeat(64))).toThrow('spreadsheet error');
  });
});
