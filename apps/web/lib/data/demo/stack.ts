import type { StackItem } from '../../progress/types';

/**
 * The Worked Example sheet, row by row: a premium-gym member's 21 items with the answers they
 * tapped. Origins are fixture choices (the sheet does not give them). Costs are the sheet's,
 * which match the catalog's typical costs. See docs/ONBOARDING.md section 6.
 */
export const demoGoals = ['sleep (general)', 'skin / hair'];

type Seed = Omit<StackItem, 'id' | 'position' | 'answers' | 'chips' | 'unknown' | 'status'> &
  Partial<Pick<StackItem, 'answers' | 'chips' | 'unknown' | 'status'>>;

const seeds: Seed[] = [
  {
    itemKey: 'premium-gym-membership-equinox-life-time',
    monthlyCost: 250,
    origin: 'other',
    answers: { visitsLast30Days: 11 },
    chips: { visitsLast30Days: '8 or more' },
  },
  {
    itemKey: 'boutique-class-membership-barry-s-soulcycle-f45-orangetheory',
    monthlyCost: 200,
    origin: 'friend',
    answers: { visitsLast30Days: 2, visitsPrevious30Days: 6 },
    chips: { visitsLast30Days: '1 to 3', visitsPrevious30Days: '4 to 7' },
  },
  {
    itemKey: 'recovery-studio-membership-restore-remedy-place-othership',
    monthlyCost: 250,
    origin: 'online',
    answers: { visitsLast30Days: 1 },
    chips: { visitsLast30Days: '1 to 3' },
  },
  {
    itemKey: 'massage-membership-massage-envy-squeeze',
    monthlyCost: 90,
    origin: 'other',
    answers: { bankedCredits: 3, daysSinceLastUse: 75 },
    chips: { lastUsed: '1 to 3 months ago' },
  },
  {
    itemKey: 'meditation-app-calm-headspace',
    monthlyCost: 15,
    origin: 'podcast',
    answers: { stillPaying: true, daysSinceLastUse: 60 },
    chips: { lastUsed: '1 to 3 months ago' },
  },
  {
    itemKey: 'fitness-app-subscription-peloton-app-apple-fitness-ladder',
    monthlyCost: 25,
    origin: 'friend',
    answers: { stillPaying: true, daysSinceLastUse: 2 },
    chips: { lastUsed: 'This week' },
  },
  { itemKey: 'greens-powder-ag1-etc', monthlyCost: 90, origin: 'podcast', answers: { stillPaying: true } },
  {
    itemKey: 'magnesium-any-form',
    monthlyCost: 22,
    origin: 'online',
    answers: { form: 'citrate', dose: 120, goal: 'sleep' },
    chips: { form: 'Citrate', goal: 'Sleep' },
  },
  {
    itemKey: 'collagen-drinks-and-beauty-gummies',
    monthlyCost: 40,
    origin: 'online',
    answers: { dose: 2, servingAmount: 2, servingsPerDay: 1 },
  },
  {
    itemKey: 'omega-3-fish-oil',
    monthlyCost: 20,
    origin: 'friend',
    answers: { dose: 300, servingAmount: 300, servingsPerDay: 1 },
  },
  { itemKey: 'vitamin-c-serum', monthlyCost: 60, origin: 'online', answers: { form: 'unknown' }, chips: { form: 'Not sure' } },
  { itemKey: 'toner-hydrating-or-balancing', monthlyCost: 25, origin: 'other', answers: { hydrationRoutineDuplicates: true } },
  {
    itemKey: 'eye-cream-when-you-already-use-a-moisturiser',
    monthlyCost: 45,
    origin: 'other',
    answers: { hydrationRoutineDuplicates: true, eyeCreamHasAdditionalActive: false },
  },
  { itemKey: 'retinol-retinoid-nightly', monthlyCost: 40, origin: 'online' },
  { itemKey: 'sunscreen-daily-spf-30', monthlyCost: 20, origin: 'other' },
  {
    itemKey: 'facials-monthly',
    monthlyCost: 150,
    origin: 'friend',
    answers: { stillPaying: true },
    chips: { lastUsed: 'This month' },
  },
  { itemKey: 'coffee-after-2pm', monthlyCost: 0, origin: 'other', answers: { time: '2 to 5pm' }, chips: { time: '2 to 5pm' } },
  { itemKey: 'alcohol-in-the-evening', monthlyCost: 80, origin: 'other', chips: { nightsPerWeek: '3 to 4' } },
  {
    itemKey: 'training-after-7pm',
    monthlyCost: 0,
    origin: 'other',
    answers: { vigorous: true, workoutToBedMinutes: 90, workoutNightsPerWeek: 4, workoutEndHour: 21 },
    readFrom: { source: 'workouts', summary: 'Four evening sessions a week, ending around 9pm.' },
  },
  { itemKey: 'late-dinner-within-2-3-h-of-bed', monthlyCost: 0, origin: 'other', chips: { dinnerToBedMinutes: 'Under 1.5 hours' } },
  { itemKey: null, customName: 'Oura ring', dataSource: true, monthlyCost: 6, origin: 'other' },
];

export function demoStack(): StackItem[] {
  return seeds.map((s, i) => ({
    answers: {},
    chips: {},
    unknown: [],
    status: 'listed',
    ...s,
    id: `demo-${i + 1}`,
    position: i,
  }));
}
