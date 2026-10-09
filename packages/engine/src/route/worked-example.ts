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
  // "2 visits last month" after a normal month: not unused yet, so the overlap with Equinox decides it.
  barrys: { goal: 'fitness', visitsLast30Days: 2, visitsPrevious30Days: 6 },
  // One visit in 60 days means at most one in the last 30.
  restore: { goal: 'recovery', visitsLast30Days: 1, visitsLast60Days: 1 },
  massage: { goal: 'stress', bankedCredits: 3, lastUsed: 'longer' },
  calm: { goal: 'sleep', lastUsed: 'longer', stillPaying: true },
  peloton: { goal: 'fitness', usesLast30Days: 9, stillPaying: true, lastUsed: 'this week' },
  ag1: { goal: 'nothing specific', stillPaying: true },
  magnesium: { goal: 'sleep', form: 'citrate', dose: 120, doseUnit: 'mg elemental' },
  collagen: { goal: 'skin', dose: 2, doseUnit: 'g' },
  'vitamin-c': { goal: 'skin', form: 'unknown' },
  // The fish-oil row supplies a dose but no goal: a dose-too-low drop holds for every goal.
  fish: { dose: 300, doseUnit: 'mg EPA+DHA' },
  toner: { goal: 'skin', hydrationRoutineDuplicates: true },
  eye: { goal: 'skin', hydrationRoutineDuplicates: true, eyeCreamHasAdditionalActive: false },
  retinol: { goal: 'skin' },
  sunscreen: { goal: 'skin' },
  facial: { goal: 'skin', lastUsed: 'this month' },
  coffee: { goal: 'sleep', time: '2 to 5pm' },
  alcohol: { goal: 'sleep', nightsPerWeek: 3 },
  // "Four evening sessions ending 9pm" is read as hard sessions within two hours of bed (team decision 2026-10-08).
  training: { goal: 'sleep', workoutNightsPerWeek: 4, workoutEndHour: 21, vigorous: true, workoutToBedMinutes: 90 },
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
  // Decisions of 2026-10-08 (OPEN_QUESTIONS: WORKED_TOTAL, WORKED_COUNTS, WORKED_ORDER): the table
  // is the source and its prose paragraph is superseded. The headline counts every entered cost
  // ($1,428); the Protected data source is not a can't-measure item (2); observed items rank by
  // expected effect like everything else, and the first assigned test is coffee.
  if (total !== cell('C27'))
    issues.push({
      code: 'WORKED_TOTAL',
      message: `Line items total $${total}; Worked Example!C27 says $${cell('C27')}.`,
    });
  if (cell('B30') !== 2)
    issues.push({
      code: 'WORKED_COUNTS',
      message: `Worked Example!B30 says ${cell('B30')} can't-measure items; the decision is 2.`,
    });
  const firstAssigned = stack.runnable.find((item) => item.onDays === 'assign');
  if (stack.runnable[0]?.id !== 'alcohol' || firstAssigned?.id !== 'coffee')
    issues.push({
      code: 'WORKED_ORDER',
      message: `Expected alcohol first by effect and coffee as the first assigned test; got ${stack.runnable.map((item) => item.id).join(', ')}.`,
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
