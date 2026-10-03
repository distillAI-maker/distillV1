import type { RuleAnswers } from '@distill/engine';

/**
 * How each answer field a rule can ask for is collected. The engine says which fields are
 * missing (needsAnswers); this says how to ask. Ranges are chips; whether a chip is enough or an
 * exact number is needed is decided by probing the rule across the range (resolve.ts), never by
 * copying a threshold here.
 */

export type AskableField = Exclude<keyof RuleAnswers, 'inventoryKeys' | 'source' | 'prescription' | 'hormone' | 'clinicalService' | 'diagnosedCondition'>;

export interface RangeChip {
  label: string;
  min: number;
  max: number;
  /** Sibling values the same chip sets, for example lastUsed beside daysSinceLastUse. */
  also?: Partial<RuleAnswers>;
}

export type FieldSpec =
  | { kind: 'bool'; notSure?: boolean }
  | { kind: 'number'; unit?: string; min?: number; max?: number; step?: number }
  | { kind: 'range'; chips: RangeChip[]; exactUnit?: string; exactMin?: number; exactMax?: number }
  | { kind: 'form' }
  | { kind: 'dose' }
  | { kind: 'time' }
  | { kind: 'goal' };

const visits: RangeChip[] = [
  { label: '0', min: 0, max: 0 },
  { label: '1 to 3', min: 1, max: 3 },
  { label: '4 to 7', min: 4, max: 7 },
  { label: '8 or more', min: 8, max: 31 },
];
const nights: RangeChip[] = [
  { label: '0', min: 0, max: 0 },
  { label: '1 to 2', min: 1, max: 2 },
  { label: '3 to 4', min: 3, max: 4 },
  { label: '5 or more', min: 5, max: 7 },
];
const lastUsed: RangeChip[] = [
  { label: 'This week', min: 0, max: 7, also: { lastUsed: 'this week' } },
  { label: 'This month', min: 0, max: 31, also: { lastUsed: 'this month' } },
  { label: '1 to 3 months ago', min: 30, max: 92, also: { lastUsed: '1 to 3 months ago' } },
  { label: 'Longer', min: 93, max: 730, also: { lastUsed: 'longer' } },
  { label: "Can't remember", min: 93, max: 730, also: { lastUsed: 'cannot remember' } },
];

export const fieldSpecs: Record<AskableField, FieldSpec> = {
  goal: { kind: 'goal' },
  dose: { kind: 'dose' },
  doseUnit: { kind: 'dose' },
  form: { kind: 'form' },
  time: { kind: 'time' },
  onMedication: { kind: 'bool', notSure: true },
  onAntidepressant: { kind: 'bool', notSure: true },
  diabetes: { kind: 'bool', notSure: true },
  prediabetes: { kind: 'bool', notSure: true },
  alcoholMostNights: { kind: 'bool' },
  liverCondition: { kind: 'bool', notSure: true },
  vegan: { kind: 'bool' },
  vegetarian: { kind: 'bool' },
  age: { kind: 'number', unit: 'years', min: 13, max: 110, step: 1 },
  onMetformin: { kind: 'bool', notSure: true },
  onAcidReducers: { kind: 'bool', notSure: true },
  deficiency: { kind: 'bool', notSure: true },
  namedProblem: { kind: 'bool', notSure: true },
  trainingMinutesPerDay: { kind: 'number', unit: 'minutes a day', min: 0, max: 600, step: 5 },
  keto: { kind: 'bool' },
  stillPaying: { kind: 'bool', notSure: true },
  cupsPerDay: {
    kind: 'range',
    chips: [
      { label: '1', min: 1, max: 1 },
      { label: '2', min: 2, max: 2 },
      { label: '3', min: 3, max: 3 },
      { label: '4 or more', min: 4, max: 10 },
    ],
    exactUnit: 'cups a day',
    exactMin: 0,
    exactMax: 20,
  },
  nightsPerWeek: { kind: 'range', chips: nights, exactUnit: 'nights a week', exactMin: 0, exactMax: 7 },
  dinnerToBedMinutes: {
    kind: 'range',
    chips: [
      { label: 'Under 1.5 hours', min: 0, max: 89 },
      { label: '1.5 to 3 hours', min: 90, max: 180 },
      { label: 'Over 3 hours', min: 181, max: 480 },
    ],
    exactUnit: 'minutes',
    exactMin: 0,
    exactMax: 600,
  },
  bathroomNightsPerWeek: {
    kind: 'range',
    chips: [
      { label: '0', min: 0, max: 0 },
      { label: '1 to 2', min: 1, max: 2 },
      { label: '3 or more', min: 3, max: 7 },
    ],
    exactUnit: 'nights a week',
    exactMin: 0,
    exactMax: 7,
  },
  vigorous: { kind: 'bool' },
  workoutToBedMinutes: { kind: 'number', unit: 'minutes', min: 0, max: 600, step: 5 },
  workoutEndHour: {
    kind: 'range',
    chips: [
      { label: 'Before 7pm', min: 0, max: 18 },
      { label: '7 to 8pm', min: 19, max: 19 },
      { label: '8 to 9pm', min: 20, max: 20 },
      { label: 'After 9pm', min: 21, max: 23 },
    ],
    exactUnit: 'hour, 0 to 23',
    exactMin: 0,
    exactMax: 23,
  },
  workoutNightsPerWeek: { kind: 'number', unit: 'nights a week', min: 0, max: 7, step: 1 },
  daysSinceLastUse: { kind: 'range', chips: lastUsed, exactUnit: 'days ago', exactMin: 0, exactMax: 3650 },
  lastUsed: { kind: 'range', chips: lastUsed, exactUnit: 'days ago', exactMin: 0, exactMax: 3650 },
  phoneNightsPerWeek: {
    kind: 'range',
    chips: [
      { label: '0 to 2', min: 0, max: 2 },
      { label: '3 to 5', min: 3, max: 5 },
      { label: 'Most nights', min: 6, max: 7 },
    ],
    exactUnit: 'nights a week',
    exactMin: 0,
    exactMax: 7,
  },
  wakeSpreadMinutes: { kind: 'number', unit: 'minutes', min: 0, max: 600, step: 5 },
  weekendDelayMinutes: { kind: 'number', unit: 'minutes', min: 0, max: 600, step: 5 },
  napHour: { kind: 'number', unit: 'hour, 0 to 23', min: 0, max: 23, step: 1 },
  napMinutes: { kind: 'number', unit: 'minutes', min: 0, max: 240, step: 5 },
  napDaysPerWeek: { kind: 'number', unit: 'days a week', min: 0, max: 7, step: 1 },
  snores: { kind: 'bool', notSure: true },
  possibleSleepApnoea: { kind: 'bool', notSure: true },
  gaspingOrChoking: { kind: 'bool', notSure: true },
  comfortableNasalBreathing: { kind: 'bool', notSure: true },
  blockedNose: { kind: 'bool' },
  noisyRoom: { kind: 'bool' },
  snoringPartner: { kind: 'bool' },
  blackedOutRoom: { kind: 'bool' },
  sleepsHot: { kind: 'bool' },
  allergies: { kind: 'bool' },
  heavyTraffic: { kind: 'bool' },
  visitsLast30Days: { kind: 'range', chips: visits, exactUnit: 'visits', exactMin: 0, exactMax: 62 },
  visitsPrevious30Days: { kind: 'range', chips: visits, exactUnit: 'visits', exactMin: 0, exactMax: 62 },
  visitsLast60Days: { kind: 'number', unit: 'visits', min: 0, max: 124, step: 1 },
  packageUnused: { kind: 'bool' },
  bankedCredits: { kind: 'number', unit: 'credits', min: 0, max: 60, step: 1 },
  currentPain: { kind: 'bool' },
  subscriptionHasAdditionalTests: { kind: 'bool', notSure: true },
  bothWearables: { kind: 'bool' },
  roomTemperatureC: { kind: 'number', unit: '°C', min: 5, max: 35, step: 0.5 },
};

export const askableFields = Object.keys(fieldSpecs) as AskableField[];
