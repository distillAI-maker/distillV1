import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { needsItemRule, readCatalog } from '../../../catalog/src/ingest.js';
import { evaluateItemRule, itemRules, type RuleAnswers, type RuleOutcome } from './index.js';
import type { Item } from '@distill/catalog';

const catalog = readCatalog(
  fileURLToPath(new URL('../../../../data/Routing-Table_V3.xlsx', import.meta.url)),
);
const byKey = new Map(catalog.items.map((i) => [i.key, i]));
function run(key: string, answers: RuleAnswers) {
  return evaluateItemRule(byKey.get(key)!, answers);
}
type Case = readonly [RuleAnswers, Partial<RuleOutcome>];
const T3 = { tier: 'T3' } as const;
const T1 = { tier: 'T1' } as const;
const SMALL = { tier: 'T3_TOO_SMALL', canRunAnyway: true } as const;
const UNUSED = { tier: 'T2', reason: 'not being used' } as const;
const KEEP = { tier: 'T3', keep: true } as const;
const PROTECTED = { tier: 'PROTECTED' } as const;
const NO_HYPOTHESIS = { tier: 'T3', notHypothesis: true } as const;

// These expected boundaries are transcribed independently of the implementation.
const floors: readonly [
  string,
  number,
  RuleAnswers['doseUnit'],
  RuleOutcome['tier'],
  RuleAnswers?,
][] = [
  ['magnesium-any-form', 200, 'mg elemental', 'T3_TOO_SMALL', { form: 'citrate', goal: 'sleep' }],
  ['magnesium-l-threonate', 1, 'g', 'T3_TOO_SMALL'],
  ['l-theanine', 100, 'mg', 'T3_TOO_SMALL'],
  ['glycine', 1, 'g', 'T3_TOO_SMALL'],
  ['ashwagandha-ksm-66-sensoril', 250, 'mg', 'T1_QUEUED_SLOW', { form: 'KSM-66' }],
  ['ashwagandha-ksm-66-sensoril', 1000, 'mg', 'T1_QUEUED_SLOW', { form: 'plain root powder' }],
  ['valerian', 300, 'mg', 'T3_TOO_SMALL'],
  ['tart-cherry-juice-extract', 240, 'ml', 'T3_TOO_SMALL', { form: 'juice' }],
  ['tart-cherry-juice-extract', 480, 'mg', 'T3_TOO_SMALL', { form: 'extract' }],
  ['cbd', 25, 'mg', 'T3_TOO_SMALL', { onMedication: false }],
  ['5-htp', 100, 'mg', 'T3_TOO_SMALL', { onAntidepressant: false }],
  ['omega-3-fish-oil', 500, 'mg EPA+DHA', 'T3'],
  ['krill-oil', 1000, 'mg EPA+DHA', 'T3'],
  ['creatine-monohydrate', 2, 'g', 'T3'],
  ['beta-alanine', 2, 'g', 'T3'],
  ['collagen-peptides', 5, 'g', 'T3'],
  ['hyaluronic-acid-oral', 120, 'mg', 'T3'],
  ['glucosamine-chondroitin', 1000, 'mg', 'T3'],
  ['rhodiola', 200, 'mg', 'T3'],
  ['saffron', 30, 'mg', 'T3'],
  ['berberine', 1000, 'mg', 'T3', { onMedication: false, diabetes: false, prediabetes: false }],
];
const cases = {
  'magnesium-any-form': [
    [
      { form: 'oxide', dose: 400, doseUnit: 'mg elemental' },
      { tier: 'T2', reason: 'form not absorbed' },
    ],
    [
      { form: 'not sure', dose: 100, doseUnit: 'mg elemental' },
      { ...T3, needsAnswers: ['form'] },
    ],
    [{ form: 'glycinate', dose: 400, doseUnit: 'mg elemental', goal: 'cramps' }, T3],
  ],
  melatonin: [
    [
      { dose: 1, doseUnit: 'mg' },
      { ...T1, notes: [], safetyNoteRequired: false },
    ],
    [
      { dose: 5, doseUnit: 'mg' },
      { ...T1, notes: ['LESS_IS_MORE'], safetyNoteRequired: false },
    ],
    [
      { dose: 6, doseUnit: 'mg' },
      { ...T1, safetyNoteRequired: true },
    ],
  ],
  cbd: [
    [{ dose: 1, doseUnit: 'mg', onMedication: true }, PROTECTED],
    [
      { dose: 1, doseUnit: 'mg' },
      { ...T3, needsAnswers: ['onMedication'] },
    ],
  ],
  kava: [
    [{ liverCondition: true }, PROTECTED],
    [{ alcoholMostNights: true }, { ...T3, safetyNoteRequired: true }],
    [{ alcoholMostNights: false, liverCondition: false }, SMALL],
  ],
  '5-htp': [[{ dose: 1, doseUnit: 'mg', onAntidepressant: true }, PROTECTED]],
  'lavender-oil-oral-silexan': [
    [{ form: 'Silexan 80 mg' }, SMALL],
    [
      { form: 'essential oil' },
      { tier: 'T2', reason: 'form not absorbed', safetyNoteRequired: true },
    ],
    [{ form: 'not sure' }, T3],
  ],
  'sleep-gummies-blend': [
    [
      { dose: 0, doseUnit: 'mg' },
      { ...SMALL, relatedExperiment: 'sleep-tea-blend-valerian-passionflower-lemon-balm' },
    ],
    [
      { dose: 3, doseUnit: 'mg' },
      { ...SMALL, notes: [] },
    ],
    [{ dose: 4, doseUnit: 'mg' }, { notes: ['LESS_IS_MORE'] }],
  ],
  'vitamin-d3': [
    [
      { dose: 10000, doseUnit: 'IU' },
      { ...T3, safetyNoteRequired: false },
    ],
    [
      { dose: 10001, doseUnit: 'IU' },
      { ...T3, safetyNoteRequired: true },
    ],
  ],
  'vitamin-b12': [
    [{ vegan: true }, { ...T3, notes: ['GET_A_LEVEL'] }],
    [{ age: 61 }, T3],
    [
      { vegan: false, vegetarian: false, age: 59, onMetformin: false, onAcidReducers: false },
      { tier: 'T2', reason: 'tested, found nothing' },
    ],
    [{ age: 60 }, { ...T3, teamQuestion: 'B12_AGE_60' }],
  ],
  'omega-3-fish-oil': [
    [
      { dose: 500, doseUnit: 'mg EPA+DHA' },
      { ...T3, notes: ['BELOW_STUDIED_DOSE'] },
    ],
    [
      { dose: 1000, doseUnit: 'mg EPA+DHA' },
      { ...T3, notes: [] },
    ],
  ],
  'creatine-monohydrate': [
    [
      { dose: 5, doseUnit: 'g', form: 'HCl' },
      { ...KEEP, notes: ['MONOHYDRATE_STUDIED_FORM'] },
    ],
  ],
  'protein-powder': [[{}, T3]],
  'electrolytes-lmnt-etc': [
    [{ keto: true }, KEEP],
    [{ trainingMinutesPerDay: 61 }, KEEP],
    [
      { trainingMinutesPerDay: 60, keto: false },
      { ...T3, notes: ['WATER_DOES_THIS'] },
    ],
  ],
  'greens-powder-ag1-etc': [
    [
      { stillPaying: true },
      { ...T3, notes: ['ANNUAL_COST'], overlapCheck: ['daily multivitamin'] },
    ],
  ],
  'collagen-peptides': [
    [
      { dose: 5, doseUnit: 'g' },
      { ...T3, notes: ['BELOW_STUDIED_DOSE'] },
    ],
    [
      { dose: 10, doseUnit: 'g', goal: 'pain' },
      { ...T3, dailyRating: 'pain', notes: [] },
    ],
  ],
  'turmeric-curcumin': [
    [{ form: 'plain turmeric' }, { tier: 'T2', reason: 'form not absorbed' }],
    [{ form: 'phytosome / Meriva' }, { ...T3, dailyRating: 'pain' }],
    [{ form: 'other' }, { ...T3, needsAnswers: ['form'] }],
  ],
  'nmn-nr': [[{}, { ...T3, notes: ['ANNUAL_COST'] }]],
  'zinc-daily': [
    [
      { form: 'daily', deficiency: false, dose: 40, doseUnit: 'mg' },
      { tier: 'T2', safetyNoteRequired: false },
    ],
    [
      { form: 'daily', deficiency: false, dose: 41, doseUnit: 'mg' },
      { tier: 'T2', safetyNoteRequired: true },
    ],
    [{ form: 'lozenges when ill' }, KEEP],
    [{ deficiency: true }, PROTECTED],
  ],
  'vitamin-c-daily': [[{}, T3]],
  elderberry: [[{}, T3]],
  'probiotic-generic-daily': [
    [{ form: 'named strain', namedProblem: true }, KEEP],
    [
      { form: 'named strain', namedProblem: false },
      { ...T3, dailyRating: 'gut' },
    ],
    [{ form: 'named strain' }, { ...T3, needsAnswers: ['namedProblem'] }],
    [{ form: 'generic blend' }, { ...T3, dailyRating: 'gut' }],
    [{ form: 'not sure' }, { ...T3, dailyRating: 'gut' }],
  ],
  berberine: [
    [{ dose: 1, doseUnit: 'mg', diabetes: true }, PROTECTED],
    [{ onMedication: true }, PROTECTED],
    [{ prediabetes: true }, PROTECTED],
  ],
  'coffee-after-2pm': [
    [{ time: 'before noon' }, NO_HYPOTHESIS],
    [{ time: '12 to 2pm' }, { ...SMALL, expectedEffect: 0.6 }],
    [{ time: '2 to 5pm' }, T1],
    [{ time: 'after 5pm' }, T1],
  ],
  'second-or-third-coffee': [
    [{ cupsPerDay: 1 }, NO_HYPOTHESIS],
    [{ cupsPerDay: 2 }, SMALL],
    [{ cupsPerDay: 3 }, { ...T1, expectedEffect: 0.8 }],
  ],
  'energy-drinks': [
    [{ time: 'after 2pm' }, { ...T1, expectedEffect: 1 }],
    [{ time: 'before noon' }, SMALL],
  ],
  'decaf-swap-after-noon': [[{}, { ...NO_HYPOTHESIS, relatedExperiment: 'coffee-after-2pm' }]],
  'matcha-green-tea-in-the-afternoon': [
    [{ time: 'before 2pm' }, NO_HYPOTHESIS],
    [{ time: 'after 2pm' }, SMALL],
  ],
  'alcohol-in-the-evening': [
    [{ nightsPerWeek: 0 }, { ...T3, excludeFromInventory: true }],
    [{ nightsPerWeek: 2 }, { ...T1, expectedEffect: 1.5, suggestedWeeks: [3, 4] }],
    [{ nightsPerWeek: 3 }, { ...T1, suggestedWeeks: [2, 2] }],
  ],
  'late-dinner-within-2-3-h-of-bed': [
    [{ dinnerToBedMinutes: 89 }, { ...T1, expectedEffect: 0.8 }],
    [{ dinnerToBedMinutes: 90 }, { ...T3, teamQuestion: 'DINNER_90_MINUTES' }],
    [{ dinnerToBedMinutes: 180 }, SMALL],
    [{ dinnerToBedMinutes: 181 }, NO_HYPOTHESIS],
  ],
  'fluids-after-8pm': [
    [{ bathroomNightsPerWeek: 2 }, SMALL],
    [{ bathroomNightsPerWeek: 3 }, { ...T3, teamQuestion: 'BATHROOM_THREE_NIGHTS' }],
    [{ bathroomNightsPerWeek: 4 }, { ...T1, expectedEffect: 1 }],
  ],
  'nicotine-pouches-vape': [
    [{ time: 'daytime only' }, NO_HYPOTHESIS],
    [{ time: 'some after 6pm' }, T1],
  ],
  'training-after-7pm': [
    [
      { vigorous: true, workoutToBedMinutes: 120, workoutNightsPerWeek: 3, workoutEndHour: 21 },
      { ...T1, expectedEffect: 1 },
    ],
    [{ vigorous: false }, { ...SMALL, expectedEffect: 0.4 }],
    [{ workoutEndHour: 19 }, SMALL],
    [{ vigorous: true, workoutNightsPerWeek: 2, workoutEndHour: 21, workoutToBedMinutes: 60 }, T3],
  ],
  'hiit-in-the-evening': [
    [{ workoutToBedMinutes: 120 }, T1],
    [{ workoutToBedMinutes: 121 }, NO_HYPOTHESIS],
  ],
  'cold-plunge-ice-bath': [
    [{ time: 'evening' }, { ...SMALL, metric: 'Time to fall asleep' }],
    [{ time: 'morning' }, { ...SMALL, metric: 'Overnight HRV' }],
  ],
  'sauna-post-workout-or-evening': [
    [{ time: 'evening' }, { ...T1, metric: 'Time to fall asleep' }],
    [{ time: 'midday' }, { ...SMALL, metric: 'Overnight HRV', expectedEffect: 0.5 }],
  ],
  'hot-bath-shower-1-2-h-before-bed': [[{}, { ...T1, notes: ['SAUNA_STAND_IN'] }]],
  'meditation-app-calm-headspace': [
    [{ daysSinceLastUse: 31, stillPaying: true }, UNUSED],
    [{ daysSinceLastUse: 31, stillPaying: false }, SMALL],
    [{ daysSinceLastUse: 30, stillPaying: true }, SMALL],
    [{ daysSinceLastUse: 31 }, T3],
  ],
  'journaling-worry-list-before-bed': [[{}, T1]],
  'screens-phone-in-bed': [
    [{ phoneNightsPerWeek: 2 }, NO_HYPOTHESIS],
    [{ phoneNightsPerWeek: 4 }, { ...T3, teamQuestion: 'PHONE_THREE_TO_FIVE_NIGHTS' }],
    [{ phoneNightsPerWeek: 6 }, T1],
  ],
  'consistent-wake-time-30-min': [
    [{ wakeSpreadMinutes: 29 }, KEEP],
    [{ wakeSpreadMinutes: 30 }, T3],
    [{ wakeSpreadMinutes: 60 }, T3],
    [{ wakeSpreadMinutes: 61 }, T1],
  ],
  'weekend-sleep-in-over-1-h': [
    [{ weekendDelayMinutes: 60 }, NO_HYPOTHESIS],
    [{ weekendDelayMinutes: 61 }, { ...SMALL, notes: ['WEEKLY_BLOCKS_ONLY'] }],
  ],
  'afternoon-nap-after-3pm-or-over-30-min': [
    [{ napHour: 15, napMinutes: 30, napDaysPerWeek: 3 }, NO_HYPOTHESIS],
    [{ napHour: 16, napMinutes: 20, napDaysPerWeek: 3 }, T1],
    [{ napHour: 12, napMinutes: 31, napDaysPerWeek: 3 }, T1],
    [{ napHour: 16, napMinutes: 31, napDaysPerWeek: 2 }, NO_HYPOTHESIS],
  ],
  'weighted-blanket': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [{ daysSinceLastUse: 30 }, SMALL],
  ],
  'mouth-tape': [
    [{ possibleSleepApnoea: true, daysSinceLastUse: 100 }, PROTECTED],
    [{ comfortableNasalBreathing: false }, PROTECTED],
    [{ gaspingOrChoking: true }, PROTECTED],
    [
      {
        daysSinceLastUse: 1,
        snores: true,
        possibleSleepApnoea: false,
        gaspingOrChoking: false,
        comfortableNasalBreathing: true,
      },
      { ...T1, expectedEffect: 0.8, safetyNoteRequired: true },
    ],
  ],
  'nasal-strips-dilator': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [
      { daysSinceLastUse: 1, blockedNose: true },
      { ...SMALL, expectedEffect: 0.7 },
    ],
  ],
  'blue-light-blocking-glasses': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [{ daysSinceLastUse: 30 }, SMALL],
  ],
  'eye-mask': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [
      { daysSinceLastUse: 1, blackedOutRoom: true },
      { ...T3, overlapCheck: ['blackout-light-leak'] },
    ],
  ],
  earplugs: [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [
      { daysSinceLastUse: 1, noisyRoom: true },
      { ...T1, expectedEffect: 1 },
    ],
    [{ daysSinceLastUse: 1, snoringPartner: true }, T1],
  ],
  'white-noise-sound-machine': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [
      { daysSinceLastUse: 1, noisyRoom: false },
      { ...T3, notes: ['MAY_DO_THE_OPPOSITE'], overlapCheck: ['earplugs'] },
    ],
  ],
  'sleep-headphones-sleep-stories': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [{ daysSinceLastUse: 1 }, T3],
  ],
  'sunrise-alarm-hatch-etc': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [{ daysSinceLastUse: 1 }, { ...T3, overlapCheck: ['wake-up light'] }],
  ],
  'light-therapy-box-10-000-lux': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [
      { daysSinceLastUse: 1, goal: 'mood' },
      { ...T3, dailyRating: 'mood' },
    ],
    [{ daysSinceLastUse: 1, goal: 'sleep' }, SMALL],
  ],
  'red-light-therapy-panel': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [
      { daysSinceLastUse: 1, goal: 'skin' },
      { ...T3, dailyRating: 'skin' },
    ],
    [
      { daysSinceLastUse: 1, goal: 'sleep' },
      { ...T3, teamQuestion: 'RED_LIGHT_GOALS' },
    ],
  ],
  'eight-sleep-cooling-mattress-pad': [
    [{ daysSinceLastUse: 30, stillPaying: true, sleepsHot: true }, UNUSED],
    [
      { daysSinceLastUse: 29, stillPaying: true, sleepsHot: true },
      { ...T1, expectedEffect: 0.9 },
    ],
    [{ stillPaying: false, sleepsHot: false }, T3],
  ],
  'massage-gun': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [{ daysSinceLastUse: 1 }, { ...T3, dailyRating: 'soreness' }],
  ],
  'compression-boots-normatec': [
    [{ daysSinceLastUse: 31 }, UNUSED],
    [{ daysSinceLastUse: 1 }, T3],
  ],
  'continuous-glucose-monitor-no-diabetes': [
    [{ diabetes: true }, PROTECTED],
    [{ prediabetes: true }, PROTECTED],
    [
      { diabetes: false, prediabetes: false },
      { ...T3, notes: ['ANNUAL_COST'] },
    ],
  ],
  'second-wearable-oura-plus-whoop': [
    [
      { bothWearables: true },
      { tier: 'T2', reason: 'overlaps with something else', overlapCheck: ['wearables'] },
    ],
    [{ bothWearables: false }, T3],
  ],
  'air-purifier-bedroom': [
    [{ daysSinceLastUse: 30 }, UNUSED],
    [
      { daysSinceLastUse: 29, allergies: true },
      { ...SMALL, expectedEffect: 0.7 },
    ],
  ],
  humidifier: [
    [{ daysSinceLastUse: 30 }, UNUSED],
    [{ daysSinceLastUse: 29 }, T3],
  ],
  'vibration-plate': [
    [{ daysSinceLastUse: 30 }, UNUSED],
    [
      { daysSinceLastUse: 29, goal: 'fat loss' },
      { tier: 'T2', reason: 'tested, found nothing' },
    ],
    [{ daysSinceLastUse: 1, goal: 'bone' }, T3],
  ],
  'led-face-mask': [
    [{ daysSinceLastUse: 30 }, UNUSED],
    [{ daysSinceLastUse: 29 }, { ...T3, dailyRating: 'skin' }],
  ],
  'jaw-exerciser': [[{}, { tier: 'T2', reason: 'no way it could work', safetyNoteRequired: true }]],
  'smart-lights-warm-dim-in-the-evening': [[{}, SMALL]],
  'sauna-bathhouse-membership': [
    [{ visitsLast30Days: 1 }, UNUSED],
    [{ visitsLast30Days: 2 }, T1],
  ],
  'cryotherapy-sessions': [
    [{ visitsLast60Days: 0, packageUnused: true }, UNUSED],
    [{ visitsLast60Days: 1, packageUnused: true }, SMALL],
    [{ visitsLast60Days: 0, packageUnused: false }, SMALL],
  ],
  'iv-vitamin-drips': [[{}, { tier: 'T2', reason: 'tested, found nothing' }]],
  'massage-monthly': [
    [{ bankedCredits: 3, daysSinceLastUse: 60 }, UNUSED],
    [{ bankedCredits: 0, daysSinceLastUse: 60 }, T3],
    [{ bankedCredits: 3, daysSinceLastUse: 59 }, T3],
  ],
  'facials-monthly': [
    [{ stillPaying: true, daysSinceLastUse: 90 }, UNUSED],
    [
      { stillPaying: true, daysSinceLastUse: 89 },
      { ...T3, dailyRating: 'skin' },
    ],
    [{ stillPaying: false, daysSinceLastUse: 90 }, T3],
  ],
  acupuncture: [
    [{ daysSinceLastUse: 90 }, { ...T3, excludeFromInventory: true }],
    [{ daysSinceLastUse: 89 }, { ...T3, teamQuestion: 'ACUPUNCTURE_GOAL' }],
  ],
  'chiropractor-maintenance-visits': [
    [{ currentPain: true }, { ...T3, dailyRating: 'pain' }],
    [{ currentPain: false }, { ...T3, notes: ['MAINTENANCE_NO_EVIDENCE'] }],
  ],
  'personal-trainer': [
    [
      { visitsLast30Days: 1, visitsPrevious30Days: 1 },
      { ...T3, notes: ['COST_PER_SESSION'] },
    ],
    [{ visitsLast30Days: 2 }, KEEP],
  ],
  'nutritionist-dietitian': [[{}, PROTECTED]],
  'gym-membership': [
    [{ visitsLast30Days: 3, visitsPrevious30Days: 3 }, UNUSED],
    [
      { visitsLast30Days: 3, visitsPrevious30Days: 4 },
      { ...T3, notes: ['COST_PER_VISIT'] },
    ],
    [{ visitsLast30Days: 8 }, KEEP],
    [{ visitsLast30Days: 1 }, { ...T3, needsAnswers: ['visitsPrevious30Days'] }],
  ],
  'yoga-pilates-studio': [
    [{ visitsLast30Days: 3, visitsPrevious30Days: 3 }, UNUSED],
    [{ visitsLast30Days: 4 }, KEEP],
  ],
  'float-tank': [
    [{ packageUnused: true, daysSinceLastUse: 60 }, UNUSED],
    [{ packageUnused: false, daysSinceLastUse: 60 }, T3],
  ],
  'blood-panel-subscription-function-etc': [
    [
      { inventoryKeys: ['annual-physical-with-bloodwork'], subscriptionHasAdditionalTests: false },
      { tier: 'T2', reason: 'overlaps with something else' },
    ],
    [
      { inventoryKeys: ['annual-physical-with-bloodwork'], subscriptionHasAdditionalTests: true },
      T3,
    ],
    [{ inventoryKeys: [] }, T3],
  ],
  'stretch-studio-assisted-stretching': [
    [{ visitsLast30Days: 1 }, UNUSED],
    [{ visitsLast30Days: 2 }, T3],
  ],
  'retreat-wellness-weekend': [[{}, T3]],
  'bedroom-temperature-thermostat': [
    [{ roomTemperatureC: 21, sleepsHot: false }, SMALL],
    [{ roomTemperatureC: 21.1 }, { ...T1, expectedEffect: 1 }],
    [{ sleepsHot: true }, T1],
  ],
  'blackout-light-leak': [[{}, { ...SMALL, overlapCheck: ['eye-mask'] }]],
  'phone-charging-in-the-bedroom': [
    [{}, { ...NO_HYPOTHESIS, relatedExperiment: 'screens-phone-in-bed' }],
  ],
  'cold-plunge-ice-bath-tub-owned': [
    [{ daysSinceLastUse: 30 }, UNUSED],
    [
      { daysSinceLastUse: 29, time: 'evening' },
      { ...SMALL, metric: 'Time to fall asleep' },
    ],
  ],
} satisfies Record<string, readonly Case[]>;

describe('source rule coverage', () => {
  it('has exactly one typed function per nontrivial rule sentence, and tests for every function', () => {
    const required = catalog.items
      .filter(needsItemRule)
      .map((i) => i.key)
      .sort();
    expect(Object.keys(itemRules).sort()).toEqual(required);
    expect([...new Set([...Object.keys(cases), ...floors.map(([key]) => key)])].sort()).toEqual(
      required,
    );
  });
  it('locks the exact source sentences so spreadsheet edits require rule review', () => {
    expect(
      Object.fromEntries(catalog.items.filter(needsItemRule).map((i) => [i.key, i.ruleText])),
    ).toMatchSnapshot();
  });
});
for (const [key, list] of Object.entries(cases)) {
  describe(`${key}: "${byKey.get(key)!.ruleText}"`, () => {
    for (const [index, [answers, expected]] of list.entries())
      it(`case ${index + 1}: ${JSON.stringify(answers)}`, () =>
        expect(run(key, answers)).toMatchObject(expected));
  });
}
for (const [key, floor, unit, tier, extra = {}] of floors) {
  describe(`${key}: "${byKey.get(key)!.ruleText}" (${unit})`, () => {
    it('drops immediately below the threshold', () =>
      expect(run(key, { ...extra, dose: floor - 0.01, doseUnit: unit })).toMatchObject({
        tier: 'T2',
        reason: 'dose too low',
      }));
    it('does not drop at the threshold or above it', () => {
      expect(run(key, { ...extra, dose: floor, doseUnit: unit })).toMatchObject({ tier });
      expect(run(key, { ...extra, dose: floor + 1, doseUnit: unit })).toMatchObject({ tier });
    });
    it('does not treat a missing dose or wrong unit as a zero dose', () => {
      expect(run(key, extra)).toMatchObject({ tier: 'T3', needsAnswers: ['dose', 'doseUnit'] });
      expect(run(key, { ...extra, dose: 1, doseUnit: unit === 'IU' ? 'g' : 'IU' })).toMatchObject({
        tier: 'T3',
        needsAnswers: ['dose', 'doseUnit'],
      });
    });
  });
}
describe('safety and provenance invariants', () => {
  it.each(['doctor', 'blood test'] as const)(
    '%s overrides every item rule and omits ratings and costs',
    (source) => {
      for (const item of catalog.items) {
        expect(
          evaluateItemRule(item, { source, dose: 0, form: 'oxide', daysSinceLastUse: 100 }),
        ).toEqual({
          key: item.key,
          tier: 'PROTECTED',
          unverified: item.unverified,
          onDays: item.onDays,
        });
      }
    },
  );
  it.each(['prescription', 'hormone', 'clinicalService', 'diagnosedCondition'] as const)(
    '%s protects an otherwise droppable item',
    (field) =>
      expect(run('magnesium-any-form', { [field]: true, form: 'oxide' })).toMatchObject(PROTECTED),
  );
  it('preserves all nine observe-only flags without inventing assigned on-days', () => {
    for (const item of catalog.items.filter((i) => i.onDays === 'observe'))
      expect(evaluateItemRule(item, { nightsPerWeek: 3, time: 'after 2pm' }).onDays).toBe(
        'observe',
      );
  });
  it('keeps unknown follow-ups conservative, with cost and unverified status intact', () => {
    const r = run('omega-3-fish-oil', {});
    expect(r).toMatchObject({ tier: 'T3', monthlyCost: 20, unverified: true });
    expect(r.reason).toBeUndefined();
  });
  it('treats cannot remember as older, but does not invent an exact date for the 1–3 month chip', () => {
    expect(run('weighted-blanket', { lastUsed: 'cannot remember' })).toMatchObject(UNUSED);
    expect(run('weighted-blanket', { lastUsed: '1 to 3 months ago' })).toMatchObject({
      tier: 'T3',
      needsAnswers: ['daysSinceLastUse'],
    });
  });
  it.each([NaN, Infinity, -1])('rejects invalid dose %s', (dose) =>
    expect(() => run('glycine', { dose, doseUnit: 'g' })).toThrow('Invalid numeric answer'),
  );
  it('rejects impossible frequencies and visits', () => {
    expect(() => run('alcohol-in-the-evening', { nightsPerWeek: 8 })).toThrow(
      'Invalid weekly frequency',
    );
    expect(() => run('gym-membership', { visitsLast30Days: 1.5 })).toThrow('exact whole count');
  });
  it('never mutates the item or answers', () => {
    const item = Object.freeze(structuredClone(byKey.get('magnesium-any-form')!));
    const answers = Object.freeze({ form: 'oxide' });
    const before = structuredClone(item);
    evaluateItemRule(item, answers);
    expect(item).toEqual(before);
    expect(answers).toEqual({ form: 'oxide' });
  });
  it.each(['new-rule-item', 'constructor', 'toString'])(
    'rejects unregistered rule key %s until a reviewed function is supplied',
    (key) => {
      const item: Item = { ...byKey.get('glycine')!, key };
      expect(() => evaluateItemRule(item, {})).toThrow('Missing item rule');
    },
  );
});
