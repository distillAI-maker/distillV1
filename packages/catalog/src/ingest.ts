import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import {
  type Catalog,
  type Item,
  type Tier,
  triggerSchema,
  type FollowUpQuestion,
} from './schema.js';
import { placeholders, validateCatalog } from './validate.js';

export const REQUIRED_SHEETS = [
  'Start Here',
  'Items',
  'Experiment Priority',
  'Goal to Number',
  'Glossary',
  'Numbers we can watch',
  'Verdict Templates',
  'Tone Guide',
  'Emotional Positioning',
  'Follow-up Questions',
  'Overlap Groups',
  'Worked Example',
  'Summary',
] as const;
const tierMap: Record<string, Tier> = {
  '1': 'T1',
  '1, queued (slow)': 'T1_QUEUED_SLOW',
  '1, queued (special design)': 'T1_QUEUED_SPECIAL',
  '3, effect too small': 'T3_TOO_SMALL',
  '2': 'T2',
  '3': 'T3',
  P: 'PROTECTED',
};
const triggerMap: Record<string, FollowUpQuestion['type']> = {
  'dose & form': 'DOSE_FORM',
  frequency: 'FREQUENCY',
  'clock time': 'CLOCK_TIME',
  'nights a week': 'NIGHTS_PER_WEEK',
  'last used': 'LAST_USED',
  'still paying': 'STILL_PAYING',
  'overlap (automatic)': 'OVERLAP',
  none: 'NONE',
};
function mapped<T>(value: string, map: Record<string, T>, location: string): T {
  if (!Object.hasOwn(map, value))
    throw new Error(`${location}: unknown enum value ${JSON.stringify(value)}`);
  return map[value]!;
}
export function readCatalog(path: string): Catalog {
  const bytes = readFileSync(path);
  return ingestWorkbook(
    XLSX.read(bytes, { type: 'buffer', cellFormula: true }),
    createHash('sha256').update(bytes).digest('hex'),
  );
}
export function ingestWorkbook(wb: XLSX.WorkBook, sourceSha256: string): Catalog {
  for (const name of REQUIRED_SHEETS)
    if (!wb.Sheets[name]) throw new Error(`Missing sheet: ${name}`);
  const sheets: Catalog['sheets'] = {};
  for (const name of wb.SheetNames) {
    sheets[name] = {};
    for (const [address, cell] of Object.entries(wb.Sheets[name]!)) {
      if (address.startsWith('!')) continue;
      if (cell.t === 'e')
        throw new Error(`${name}!${address}: spreadsheet error ${cell.w ?? cell.v}`);
      if ((cell.v !== undefined && cell.v !== null && cell.v !== '') || cell.f) {
        if (cell.f && (cell.v === undefined || cell.v === null))
          throw new Error(`${name}!${address}: formula has no cached value; recalculate in Excel`);
        sheets[name]![address] = { value: cell.v ?? null, ...(cell.f ? { formula: cell.f } : {}) };
      }
    }
  }
  const value = (sheet: string, cell: string) => sheets[sheet]?.[cell]?.value ?? null;
  const str = (sheet: string, cell: string): string | null => {
    const v = value(sheet, cell);
    return v === null || String(v).trim() === '' ? null : String(v).trim();
  };
  const req = (sheet: string, cell: string): string => {
    const v = str(sheet, cell);
    if (v === null) throw new Error(`${sheet}!${cell}: missing required value`);
    return v;
  };
  const num = (sheet: string, cell: string): number => {
    const v = value(sheet, cell);
    if (typeof v !== 'number' || !Number.isFinite(v))
      throw new Error(`${sheet}!${cell}: expected a finite number, received ${JSON.stringify(v)}`);
    return v;
  };
  const bool = (sheet: string, cell: string) =>
    mapped(req(sheet, cell), { yes: true, no: false }, `${sheet}!${cell}`);
  const rows = (sheet: string, column: string, start: number) =>
    Object.keys(sheets[sheet]!)
      .filter((a) => new RegExp(`^${column}\\d+$`).test(a))
      .map((a) => Number(a.slice(column.length)))
      .filter((r) => r >= start)
      .sort((a, b) => a - b);
  // Validate the entire header contract so a moved or renamed column cannot silently shift data.
  const headers = [
    '#',
    'Key',
    'Item',
    'Do, buy, or environment',
    'Category',
    'Cost per month (USD)',
    'Cost per year (USD)',
    'Typical amount or how often',
    'What people usually take it for',
    'Can a wearable see it?',
    "Which number we'd watch",
    'Which way it should move',
    'How fast it acts and clears',
    "How we'd test it",
    'Can we run it this semester?',
    'Expected effect (in units of a normal night-to-night swing)',
    'Where the effect estimate comes from',
    'Chance of a clear answer in two weeks',
    'Tier',
    'Tier name',
    'Tier after the effect gate (what the engine uses)',
    'Can we read it from their history?',
    'On-days: assigned or observed?',
    'Lowest dose worth testing (below this = day-one drop)',
    'Evidence grade',
    'What the studies actually found',
    'Is there a known way it could work?',
    "Why it's a day-one drop (Tier 2 only)",
    "How the answer changes with the person's goal or situation",
    'Follow-up question (trigger)',
    'Question wording',
    'Answer options',
    'Rule that flips the tier (threshold)',
    'Overlap group',
    'Safety note (shown with the verdict)',
    'What the user reads on day one',
    'Needs a fact-check?',
    'What to check, and where to look',
  ];
  headers.forEach((h, i) => {
    const a = `${XLSX.utils.encode_col(i)}1`;
    if (req('Items', a) !== h) throw new Error(`Items!${a}: expected header ${h}`);
  });
  const items = rows('Items', 'B', 2).map((r) => {
    const s = (c: string) => str('Items', c + r),
      t = (c: string) => req('Items', c + r);
    return {
      key: t('B'),
      name: t('C'),
      kind: t('D'),
      category: t('E'),
      monthlyCost: num('Items', `F${r}`),
      annualCost: num('Items', `G${r}`),
      typicalAmount: s('H'),
      usualGoal: s('I'),
      visibility: t('J'),
      metricText: s('K'),
      directionText: s('L'),
      speed: mapped(
        t('M'),
        {
          'fast: acts and clears within hours': 'fast',
          'slow: builds up or clears over weeks': 'slow',
        },
        `Items!M${r}`,
      ),
      testDesign: t('N'),
      runnableThisSemester: bool('Items', `O${r}`),
      expectedEffect: s('P') === null ? null : num('Items', `P${r}`),
      effectBasis: s('Q'),
      chance: t('R'),
      naturalTier: t('S'),
      tierName: t('T'),
      tier: mapped(t('U'), tierMap, `Items!U${r}`),
      historyText: t('V'),
      onDays:
        s('W') === null
          ? null
          : mapped(
              t('W'),
              {
                'assign (we set the on and off days)': 'assign',
                'observe only (never assign an on-day)': 'observe',
              },
              `Items!W${r}`,
            ),
      lowestDoseText: t('X'),
      evidenceGrade: t('Y'),
      evidence: t('Z'),
      mechanism: t('AA'),
      dropReason: s('AB'),
      goalNotes: t('AC'),
      followUpTrigger: mapped(t('AD'), triggerMap, `Items!AD${r}`),
      question: t('AE'),
      answerOptionsText: t('AF'),
      ruleText: t('AG'),
      overlapGroups:
        s('AH')
          ?.split(',')
          .map((x) => x.trim()) ?? [],
      safety: s('AI'),
      dayOne: t('AJ'),
      unverified: bool('Items', `AK${r}`),
      factCheckNotes: s('AL'),
      source: { sheet: 'Items', row: r },
    };
  });
  // Names contain commas, including one outside parentheses (Lavender oil, oral).
  // Consume exact known names, longest first; never split arbitrary names on commas.
  const byName = [...items].sort((a, b) => b.name.length - a.name.length);
  function members(sheet: string, address: string): string[] {
    let remaining = req(sheet, address);
    const result: string[] = [];
    while (remaining) {
      const item = byName.find((i) => remaining === i.name || remaining.startsWith(i.name + ', '));
      if (!item)
        throw new Error(`${sheet}!${address}: unknown item name near ${JSON.stringify(remaining)}`);
      result.push(item.key);
      remaining = remaining.slice(item.name.length).replace(/^, /, '');
    }
    return result;
  }
  const source = (sheet: string, row: number) => ({ sheet, row });
  const metrics = rows('Numbers we can watch', 'B', 2).map((r) => ({
    name: req('Numbers we can watch', `A${r}`),
    unit: req('Numbers we can watch', `B${r}`),
    description: req('Numbers we can watch', `C${r}`),
    availability: {
      oura: req('Numbers we can watch', `D${r}`),
      whoop: req('Numbers we can watch', `E${r}`),
      apple: req('Numbers we can watch', `F${r}`),
      garminFitbit: req('Numbers we can watch', `G${r}`),
    },
    personalSwingText: req('Numbers we can watch', `H${r}`),
    detectableChangeText: req('Numbers we can watch', `I${r}`),
    drivers: req('Numbers we can watch', `J${r}`),
    notes: req('Numbers we can watch', `K${r}`),
    source: source('Numbers we can watch', r),
  }));
  const goals = rows('Goal to Number', 'D', 4).map((r) => ({
    name: req('Goal to Number', `A${r}`),
    metricText: req('Goal to Number', `B${r}`) === '(none)' ? null : req('Goal to Number', `B${r}`),
    notes: req('Goal to Number', `C${r}`),
    dailyRating: bool('Goal to Number', `D${r}`),
    source: source('Goal to Number', r),
  }));
  const overlapGroups = rows('Overlap Groups', 'D', 5).map((r) => ({
    name: req('Overlap Groups', `A${r}`),
    declaredCount: num('Overlap Groups', `B${r}`),
    itemKeys: members('Overlap Groups', `C${r}`),
    ruleText: req('Overlap Groups', `D${r}`),
    source: source('Overlap Groups', r),
  }));
  const followUpQuestions = rows('Follow-up Questions', 'E', 5).map((r) => ({
    type: mapped(req('Follow-up Questions', `A${r}`), triggerMap, `Follow-up Questions!A${r}`),
    wording: req('Follow-up Questions', `B${r}`),
    answerFormat: req('Follow-up Questions', `C${r}`),
    declaredCount: num('Follow-up Questions', `D${r}`),
    itemKeys: members('Follow-up Questions', `E${r}`),
    source: source('Follow-up Questions', r),
  }));
  if (followUpQuestions.length !== triggerSchema.options.length)
    throw new Error('Expected all eight follow-up question types');
  const verdictTemplates = rows('Verdict Templates', 'A', 2)
    .filter((r) => req('Verdict Templates', `A${r}`) !== "The 'where it came from' clause")
    .map((r) => ({
      name: req('Verdict Templates', `A${r}`),
      template: req('Verdict Templates', `B${r}`),
      example: req('Verdict Templates', `C${r}`),
      placeholders: placeholders(req('Verdict Templates', `B${r}`)),
      source: source('Verdict Templates', r),
    }));
  const toneRules = {
    bannedPhrases: [
      ...req('Tone Guide', 'B21')
        .split(',')
        .map((p) => p.replace(/\s*\([^)]*\)/g, '').trim()),
      'optimize',
    ],
    allowedPhrasesText: req('Tone Guide', 'B22'),
    maxWordsExclusive: 60,
    gatedMaxWords: 60,
    rules: rows('Tone Guide', 'B', 4)
      .filter((r) => r < 21)
      .map((r) => ({
        name: req('Tone Guide', `A${r}`),
        instruction: req('Tone Guide', `B${r}`),
        source: source('Tone Guide', r),
      })),
  };
  const pairs = (start: number, end: number, transform: (s: string) => string = (s) => s) =>
    Object.fromEntries(
      Array.from({ length: end - start + 1 }, (_, i) => [
        transform(req('Summary', `A${start + i}`)),
        num('Summary', `B${start + i}`),
      ]),
    );
  return validateCatalog({
    schemaVersion: 1,
    sourceFile: 'Routing-Table_V3.xlsx',
    sourceSha256,
    items,
    metrics,
    goals,
    overlapGroups,
    followUpQuestions,
    verdictTemplates,
    sourceClausesText: req('Verdict Templates', 'B19'),
    toneRules,
    sheets,
    summary: {
      total: num('Summary', 'B8'),
      naturalTiers: pairs(4, 7, (s) => s[0]!),
      tiers: pairs(11, 17, (s) => mapped(s, tierMap, 'Summary')),
      reasons: pairs(30, 35),
      evidenceGrades: pairs(39, 43),
      unverified: num('Summary', 'B45'),
      unverifiedT2: num('Summary', 'B46'),
      categories: Array.from({ length: 8 }, (_, i) => {
        const r = i + 20;
        return {
          name: req('Summary', `A${r}`),
          count: num('Summary', `B${r}`),
          naturalT1: num('Summary', `C${r}`),
          runnableT1: num('Summary', `D${r}`),
          t2: num('Summary', `E${r}`),
          t3: num('Summary', `F${r}`),
          protected: num('Summary', `G${r}`),
        };
      }),
    },
  });
}

/** The catalog retains the original rule sentence; rule functions live in the pure engine. */
export function needsItemRule(item: Item): boolean {
  return item.ruleText !== 'Routes on the item name alone.';
}
