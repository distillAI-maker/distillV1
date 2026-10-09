import type { RuleAnswers } from '@distill/engine';

export type DoseUnit = NonNullable<RuleAnswers['doseUnit']>;
export type TimeValue = NonNullable<RuleAnswers['time']>;

export interface FormChip {
  label: string;
  /** The string the rule compares against; null means "not sure", which stays unknown. */
  value: string | null;
}

export interface ItemSpec {
  forms?: FormChip[];
  /** The unit the rule reads the daily dose in. */
  unit?: DoseUnit;
  /** For items whose unit depends on the form (tart cherry: juice in ml, extract in mg). */
  unitByForm?: Record<string, DoseUnit>;
  /** The label on the bottle is per serving; the daily dose is serving × servings. */
  perServing?: { serving: string; count: string };
  /** Common amounts to tap instead of typing. */
  presets?: number[];
  /** The clock-time chips the rule reads, in the sheet's order. */
  times?: { label: string; value: TimeValue }[];
}

/**
 * Per-item specifics transcribed from the Follow-up Questions sheet and Items!AF, matched to the
 * strings each hand-written rule compares against. A test checks every entry against the engine.
 */
export const itemSpecs: Record<string, ItemSpec> = {
  'grounding-earthing-sheets-mats': {
    forms: [
      { label: 'Sheets or a mat', value: 'sheets or mat' },
      { label: 'Walking barefoot', value: 'barefoot walking' },
    ],
  },
  'vitamin-c-serum': {
    forms: [
      { label: 'L-ascorbic acid, 10 to 20%, dark bottle', value: 'L-ascorbic acid 10 to 20% in opaque packaging' },
      { label: 'Something else', value: 'other' },
      { label: 'Not sure', value: 'unknown' },
    ],
  },
  'collagen-drinks-and-beauty-gummies': {
    unit: 'g',
    perServing: { serving: 'g per drink or gummy', count: 'a day' },
    presets: [2, 2.5, 5, 10],
  },
  'digestive-enzymes': {
    forms: [
      { label: 'Lactase', value: 'lactase' },
      { label: 'A general blend', value: 'blend' },
    ],
  },
  'magnesium-any-form': {
    forms: [
      { label: 'Glycinate', value: 'glycinate' },
      { label: 'Citrate', value: 'citrate' },
      { label: 'Malate', value: 'malate' },
      { label: 'Threonate', value: 'threonate' },
      { label: 'Oxide', value: 'oxide' },
      { label: 'Spray or oil', value: 'spray or oil' },
      { label: 'Not sure', value: null },
    ],
    unit: 'mg elemental',
    presets: [100, 200, 300, 400],
  },
  'magnesium-l-threonate': { unit: 'g', presets: [1, 2] },
  melatonin: { unit: 'mg', presets: [0.3, 0.5, 1, 3, 5, 10] },
  'l-theanine': { unit: 'mg', presets: [100, 200, 400] },
  glycine: { unit: 'g', presets: [1, 3, 5] },
  'ashwagandha-ksm-66-sensoril': {
    forms: [
      { label: 'KSM-66', value: 'KSM-66' },
      { label: 'Sensoril', value: 'Sensoril' },
      { label: 'Other extract', value: 'other extract' },
      { label: 'Plain root powder', value: 'plain root powder' },
      { label: 'Not sure', value: null },
    ],
    unit: 'mg',
    presets: [250, 300, 600, 1000],
  },
  valerian: { unit: 'mg', presets: [300, 450, 600] },
  'tart-cherry-juice-extract': {
    forms: [
      { label: 'Juice', value: 'juice' },
      { label: 'Extract', value: 'extract' },
    ],
    unitByForm: { juice: 'ml', extract: 'mg' },
  },
  cbd: { unit: 'mg', perServing: { serving: 'mg per serving', count: 'servings a day' } },
  '5-htp': { unit: 'mg', presets: [50, 100, 200] },
  'lavender-oil-oral-silexan': {
    forms: [
      { label: 'Silexan 80 mg', value: 'Silexan 80 mg' },
      { label: 'Other oral lavender', value: 'other oral lavender' },
      { label: 'Essential oil', value: 'essential oil' },
      { label: 'Not sure', value: null },
    ],
  },
  'sleep-gummies-blend': {
    unit: 'mg',
    perServing: { serving: 'mg of melatonin per gummy, from the label', count: 'gummies a night' },
  },
  'vitamin-d3': { unit: 'IU', presets: [1000, 2000, 5000, 10000] },
  'omega-3-fish-oil': {
    unit: 'mg EPA+DHA',
    perServing: { serving: 'mg of EPA + DHA per capsule, from the back of the bottle', count: 'capsules a day' },
  },
  'krill-oil': {
    unit: 'mg EPA+DHA',
    perServing: { serving: 'mg of EPA + DHA per capsule', count: 'capsules a day' },
  },
  'creatine-monohydrate': {
    forms: [
      { label: 'Monohydrate', value: 'monohydrate' },
      { label: 'HCl', value: 'HCl' },
      { label: 'Buffered', value: 'buffered' },
      { label: 'Blend', value: 'blend' },
    ],
    unit: 'g',
    presets: [3, 5],
  },
  'beta-alanine': { unit: 'g', presets: [2, 3.2, 6.4] },
  'collagen-peptides': { unit: 'g', presets: [5, 10, 20] },
  'hyaluronic-acid-oral': { unit: 'mg', presets: [120, 200, 240] },
  'turmeric-curcumin': {
    forms: [
      { label: 'Plain turmeric', value: 'plain turmeric' },
      { label: 'Curcumin with piperine', value: 'curcumin with piperine' },
      { label: 'Phytosome or Meriva', value: 'phytosome / Meriva' },
      { label: 'Not sure', value: null },
    ],
  },
  'glucosamine-chondroitin': { unit: 'mg', presets: [500, 1000, 1500] },
  rhodiola: { unit: 'mg', presets: [200, 400, 600] },
  saffron: { unit: 'mg', presets: [15, 30] },
  'zinc-daily': {
    forms: [
      { label: 'Daily', value: 'daily' },
      { label: 'Lozenges when ill', value: 'lozenges when ill' },
    ],
    unit: 'mg',
    presets: [8, 15, 25, 50],
  },
  'probiotic-generic-daily': {
    forms: [
      { label: 'A named strain', value: 'named strain' },
      { label: 'A generic blend', value: 'generic blend' },
      { label: 'Not sure', value: 'not sure' },
    ],
  },
  berberine: { unit: 'mg', perServing: { serving: 'mg per dose', count: 'doses a day' } },
  'coffee-after-2pm': {
    times: [
      { label: 'Before noon', value: 'before noon' },
      { label: '12 to 2pm', value: '12 to 2pm' },
      { label: '2 to 5pm', value: '2 to 5pm' },
      { label: 'After 5pm', value: 'after 5pm' },
    ],
  },
  'energy-drinks': {
    times: [
      { label: 'Before noon', value: 'before noon' },
      { label: '12 to 2pm', value: '12 to 2pm' },
      { label: 'After 2pm', value: 'after 2pm' },
    ],
  },
  'matcha-green-tea-in-the-afternoon': {
    times: [
      { label: 'Before 2pm', value: 'before 2pm' },
      { label: 'After 2pm', value: 'after 2pm' },
    ],
  },
  'nicotine-pouches-vape': {
    times: [
      { label: 'Daytime only', value: 'daytime only' },
      { label: 'Some after 6pm', value: 'some after 6pm' },
      { label: 'Mostly evening', value: 'mostly evening' },
    ],
  },
  'cold-plunge-ice-bath': {
    times: [
      { label: 'Morning', value: 'morning' },
      { label: 'Evening', value: 'evening' },
    ],
  },
  'cold-plunge-ice-bath-tub-owned': {
    times: [
      { label: 'Morning', value: 'morning' },
      { label: 'Evening', value: 'evening' },
    ],
  },
  'sauna-post-workout-or-evening': {
    times: [
      { label: 'Morning', value: 'morning' },
      { label: 'Midday', value: 'midday' },
      { label: 'Evening', value: 'evening' },
    ],
  },
};

export const unitLabels: Record<DoseUnit, string> = {
  mg: 'mg a day',
  g: 'g a day',
  ml: 'ml a day',
  IU: 'IU a day',
  'mg elemental': 'mg elemental a day',
  'mg EPA+DHA': 'mg of EPA + DHA a day',
};
