import type { Catalog } from '@distill/catalog';
import { createStackRouter } from './index.js';
import type { AnswersById, InventoryItem, RoutedStack } from './types.js';

/** Source rows are explicit: the Oura data source is not invented as a catalog product. */
export const workedInventory: readonly InventoryItem[] = [
  { id: 'equinox', key: 'premium-gym-membership-equinox-life-time', monthlyCost: 250 },
  {
    id: 'barrys',
    key: 'boutique-class-membership-barry-s-soulcycle-f45-orangetheory',
    monthlyCost: 200,
  },
  {
    id: 'restore',
    key: 'recovery-studio-membership-restore-remedy-place-othership',
    monthlyCost: 250,
  },
  { id: 'massage', key: 'massage-membership-massage-envy-squeeze', monthlyCost: 90 },
  { id: 'calm', key: 'meditation-app-calm-headspace', monthlyCost: 15 },
  {
    id: 'peloton',
    key: 'fitness-app-subscription-peloton-app-apple-fitness-ladder',
    monthlyCost: 25,
  },
  { id: 'ag1', key: 'greens-powder-ag1-etc', monthlyCost: 90 },
  { id: 'magnesium', key: 'magnesium-any-form', monthlyCost: 22 },
  { id: 'collagen', key: 'collagen-drinks-and-beauty-gummies', monthlyCost: 40 },
  { id: 'fish', key: 'omega-3-fish-oil', monthlyCost: 20 },
  { id: 'vitamin-c', key: 'vitamin-c-serum', monthlyCost: 60 },
  { id: 'toner', key: 'toner-hydrating-or-balancing', monthlyCost: 25 },
  { id: 'eye', key: 'eye-cream-when-you-already-use-a-moisturiser', monthlyCost: 45 },
  { id: 'retinol', key: 'retinol-retinoid-nightly', monthlyCost: 40 },
  { id: 'sunscreen', key: 'sunscreen-daily-spf-30', monthlyCost: 20 },
  { id: 'facial', key: 'facials-monthly', monthlyCost: 150 },
  { id: 'coffee', key: 'coffee-after-2pm', monthlyCost: 0 },
  { id: 'alcohol', key: 'alcohol-in-the-evening', monthlyCost: 80 },
  { id: 'training', key: 'training-after-7pm', monthlyCost: 0 },
  { id: 'dinner', key: 'late-dinner-within-2-3-h-of-bed', monthlyCost: 0 },
  {
    id: 'oura',
    key: 'oura-ring-data-source',
    name: 'Oura ring',
    monthlyCost: 6,
    includeProtectedInSummary: true,
  },
];
/** Goals are declared fixture intents; exact values are supplied only where the example states them. */
export const workedAnswers: AnswersById = {
  equinox: { goal: 'fitness', visitsLast30Days: 11 },
  barrys: { goal: 'fitness', visitsLast30Days: 2 },
  // One visit in 60 days does not tell us its distribution across the last two months.
  restore: { goal: 'recovery', visitsLast60Days: 1 },
  massage: { goal: 'stress', bankedCredits: 3, lastUsed: 'longer' },
  calm: { goal: 'sleep', lastUsed: 'longer', stillPaying: true },
  peloton: { goal: 'fitness', usesLast30Days: 9 },
  ag1: { goal: 'nothing specific', stillPaying: true },
  magnesium: { goal: 'sleep', form: 'citrate', dose: 120, doseUnit: 'mg elemental' },
  collagen: { goal: 'skin', dose: 2, doseUnit: 'g' },
  'vitamin-c': { goal: 'skin', form: 'unknown' },
  // The fish-oil row supplies a dose but no goal. Do not invent a specific goal to bypass step 3.
  fish: { dose: 300, doseUnit: 'mg EPA+DHA' },
  toner: { goal: 'skin', hydrationRoutineDuplicates: true },
  eye: { goal: 'skin', hydrationRoutineDuplicates: true, eyeCreamHasAdditionalActive: false },
  retinol: { goal: 'skin' },
  sunscreen: { goal: 'skin' },
  facial: { goal: 'skin', lastUsed: 'this month' },
  coffee: { goal: 'sleep', time: '2 to 5pm' },
  alcohol: { goal: 'sleep', nightsPerWeek: 3 },
  training: { goal: 'sleep', workoutNightsPerWeek: 4, workoutEndHour: 21 },
  dinner: { goal: 'sleep', dinnerToBedMinutes: 60 },
  oura: { dataSource: true },
};
const expected = [
  ['equinox', 'T3', 'keep'],
  ['barrys', 'T2', 'overlaps with something else'],
  ['restore', 'T2', 'not being used'],
  ['massage', 'T2', 'not being used'],
  ['calm', 'T2', 'not being used'],
  ['peloton', 'T3', 'keep'],
  ['ag1', 'T3', undefined],
  ['magnesium', 'T2', 'dose too low'],
  ['collagen', 'T2', 'dose too low'],
  ['fish', 'T2', 'dose too low'],
  ['vitamin-c', 'T2', 'form not absorbed'],
  ['toner', 'T2', 'overlaps with something else'],
  ['eye', 'T2', 'overlaps with something else'],
  ['retinol', 'T3', 'keep'],
  ['sunscreen', 'T3', 'keep'],
  ['facial', 'T3', undefined],
  ['coffee', 'T1', undefined],
  ['alcohol', 'T1', undefined],
  ['training', 'T1', undefined],
  ['dinner', 'T1', undefined],
  ['oura', 'PROTECTED', undefined],
] as const;
export interface GoldenIssue {
  code: string;
  message: string;
}
export function inspectWorkedExample(catalog: Catalog): {
  stack: RoutedStack;
  issues: GoldenIssue[];
} {
  const stack = createStackRouter(catalog)(workedInventory, workedAnswers);
  const issues: GoldenIssue[] = [];
  const sheet = catalog.sheets['Worked Example']!;
  const cell = (address: string) => sheet[address]?.value;
  const total = workedInventory.reduce((sum, item) => sum + item.monthlyCost!, 0);
  const prose = String(cell('A35'));
  const proseTotal = Number(/\$([\d,]+) a month/.exec(prose)?.[1]?.replaceAll(',', ''));
  if (total !== cell('C27') || total !== proseTotal)
    issues.push({
      code: 'WORKED_TOTAL',
      message: `Line items/table total $${total}; Worked Example!A35 says $${proseTotal}.`,
    });
  const proseCount = Number(/(\d+) we can't measure/.exec(prose)?.[1]);
  if (cell('B30') !== proseCount)
    issues.push({
      code: 'WORKED_COUNTS',
      message: `Worked Example!B30 says ${cell('B30')} can't-measure items; A35 says ${proseCount}.`,
    });
  if (stack.runnable[0]?.id !== 'coffee')
    issues.push({
      code: 'WORKED_ORDER',
      message:
        'Start Here!B36 ranks alcohol (1.5) before coffee (1.0); Worked Example!F21 puts coffee first.',
    });
  for (const [id, tier, reason] of expected) {
    const actual = stack.items.find((item) => item.id === id)!;
    if (actual.tier !== tier || (reason === 'keep' ? !actual.keep : actual.reason !== reason))
      issues.push({
        code: `WORKED_ITEM:${id}`,
        message: `${id}: source expects ${tier}${reason ? ` (${reason})` : ''}; engine returns ${actual.tier} (${actual.detail ?? actual.reason ?? actual.step}).`,
      });
  }
  for (const [field, value] of Object.entries({
    itemsOnArrival: 21,
    monthlyTotal: 1428,
    dropsToday: 10,
    monthlyBack: 767,
    linedUpForTesting: 4,
    cantMeasure: 2,
    keep: 4,
  })) {
    if (stack.summary[field as keyof typeof stack.summary] !== value)
      issues.push({
        code: `WORKED_SUMMARY:${field}`,
        message: `${field}: source expects ${value}; engine returns ${stack.summary[field as keyof typeof stack.summary]}.`,
      });
  }
  return { stack, issues };
}
/** A release check must fail on source contradictions instead of changing expected numbers. */
export function assertWorkedExample(catalog: Catalog): RoutedStack {
  const { stack, issues } = inspectWorkedExample(catalog);
  if (issues.length)
    throw new Error(
      `Worked Example acceptance blocked:\n${issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n')}`,
    );
  return stack;
}
