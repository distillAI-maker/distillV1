import { describe, expect, it } from 'vitest';
import data from '../../../../data/catalog.json' with { type: 'json' };
import { catalogSchema } from '@distill/catalog';
import { createStackRouter, routeStack } from './index.js';
import { overlapPolicies } from './overlaps.js';
import { conditionalSourceConflicts } from './source-conflicts.js';
import {
  assertWorkedExample,
  inspectWorkedExample,
  workedAnswers,
  workedInventory,
} from './worked-example.js';
import type { AnswersById, InventoryItem, StackAnswers } from './types.js';

const catalog = catalogSchema.parse(data);
const inventory = (...keys: string[]): InventoryItem[] =>
  keys.map((key, index) => ({ id: String(index), key }));
function single(key: string, answers: StackAnswers) {
  return routeStack([{ id: 'item', key }], { item: answers }).items[0]!;
}

describe('first-match stack routing', () => {
  it.each(['doctor', 'blood test'] as const)(
    'stops at %s provenance before goals, dose, usage and overlaps',
    (source) => {
      const result = single('magnesium-any-form', {
        source,
        goal: 'nothing specific',
        form: 'oxide',
        daysSinceLastUse: 90,
      });
      expect(result).toMatchObject({
        tier: 'PROTECTED',
        step: 'protected',
        unverified: catalog.items.find((item) => item.key === 'magnesium-any-form')!.unverified,
      });
      for (const field of [
        'monthlyCost',
        'annualCost',
        'reason',
        'keep',
        'metric',
        'dailyRating',
        'canRunAnyway',
        'safety',
      ])
        expect(result).not.toHaveProperty(field);
    },
  );
  it.each(['prescription', 'hormone', 'clinicalService', 'diagnosedCondition'] as const)(
    '%s protects a normally droppable item',
    (field) => {
      expect(single('gaba-oral', { [field]: true, goal: 'sleep' }).tier).toBe('PROTECTED');
    },
  );
  it.each([
    ['mouth-tape', { possibleSleepApnoea: true }],
    ['mouth-tape', { comfortableNasalBreathing: false }],
    ['5-htp', { onAntidepressant: true }],
    ['cbd', { onMedication: true }],
    ['kava', { liverCondition: true }],
  ] as const)('safety redirects %s before a general-health goal or old usage', (key, safety) => {
    expect(single(key, { ...safety, goal: 'general health', daysSinceLastUse: 100 })).toMatchObject(
      { tier: 'PROTECTED', step: 'safety' },
    );
  });
  it('attaches source safety to a non-Protected drop', () => {
    expect(single('jaw-exerciser', { goal: 'skin' })).toMatchObject({
      tier: 'T2',
      safety: expect.any(String),
    });
  });
  it.each(['general health', 'nothing specific', 'longevity / general health'])(
    'a settled drop or an unused item holds for %s; otherwise the goal is untestable',
    (goal) => {
      expect(single('magnesium-any-form', { goal, form: 'oxide', daysSinceLastUse: 90 })).toMatchObject(
        { tier: 'T2', step: 'item_rule', reason: 'form not absorbed' },
      );
      expect(
        single('magnesium-any-form', {
          goal,
          form: 'citrate',
          dose: 400,
          doseUnit: 'mg elemental',
          daysSinceLastUse: 90,
        }),
      ).toMatchObject({ tier: 'T2', step: 'usage', reason: 'not being used' });
      expect(
        single('magnesium-any-form', { goal, form: 'citrate', dose: 400, doseUnit: 'mg elemental' }),
      ).toMatchObject({ tier: 'T3', step: 'goal', detail: 'untestable_goal' });
    },
  );
  it('drops a known no-mechanism item without asking what it is for', () => {
    expect(single('gaba-oral', {})).toMatchObject({ tier: 'T2', reason: 'no way it could work' });
  });
  it.each([undefined, 'unknown goal', 'constructor'])('asks for a recognized goal (%s)', (goal) => {
    expect(single('protein-powder', { goal })).toMatchObject({
      tier: 'T3',
      step: 'goal',
      needsAnswers: ['goal'],
    });
  });
  it('hormone goals follow the goal map clinician boundary', () => {
    expect(
      single('testosterone-booster-tribulus-fenugreek-d-aa', { goal: 'testosterone' }).tier,
    ).toBe('PROTECTED');
  });
  it('dose/form decisions precede generic usage', () => {
    expect(
      single('magnesium-any-form', { goal: 'sleep', form: 'oxide', daysSinceLastUse: 100 }),
    ).toMatchObject({ tier: 'T2', step: 'item_rule', reason: 'form not absorbed' });
  });
  it('known unused status precedes an incomplete follow-up', () => {
    expect(single('omega-3-fish-oil', { goal: 'energy', daysSinceLastUse: 31 })).toMatchObject({
      tier: 'T2',
      step: 'usage',
      reason: 'not being used',
    });
  });
  it('does not infer old use from an ambiguous month chip', () => {
    expect(
      single('weighted-blanket', { goal: 'sleep', lastUsed: '1 to 3 months ago' }),
    ).toMatchObject({ tier: 'T3', needsAnswers: ['daysSinceLastUse'] });
  });
  it('only a confirmed zero-use paid subscription is unused', () => {
    expect(
      single('water-filter', { goal: 'sleep', usesLast30Days: 0, stillPaying: true }).tier,
    ).toBe('T2');
    expect(single('water-filter', { goal: 'sleep', usesLast30Days: 0 }).tier).toBe('T3');
  });
  it('keeps an excluded no-alcohol item out of the queue and recommendations', () => {
    const stack = routeStack(inventory('alcohol-in-the-evening'), {
      '0': { goal: 'sleep', nightsPerWeek: 0 },
    });
    expect(stack.excluded).toHaveLength(1);
    expect(stack.runnable).toHaveLength(0);
    expect(stack.cantMeasure).toHaveLength(0);
  });
});

describe('effect gate, goals and ordering', () => {
  it.each([
    [
      'mouth-tape',
      {
        snores: true,
        possibleSleepApnoea: false,
        gaspingOrChoking: false,
        comfortableNasalBreathing: true,
        daysSinceLastUse: 1,
      },
      0.8,
      'T1',
    ],
    ['air-purifier-bedroom', { allergies: true, daysSinceLastUse: 1 }, 0.7, 'T3_TOO_SMALL'],
    ['nasal-strips-dilator', { blockedNose: true, daysSinceLastUse: 1 }, 0.7, 'T3_TOO_SMALL'],
    ['earplugs', { noisyRoom: true, daysSinceLastUse: 1 }, 1, 'T1'],
    [
      'eight-sleep-cooling-mattress-pad',
      { stillPaying: true, sleepsHot: true, daysSinceLastUse: 1 },
      0.9,
      'T1',
    ],
    ['late-dinner-within-2-3-h-of-bed', { dinnerToBedMinutes: 60 }, 0.8, 'T1'],
    ['bedroom-temperature-thermostat', { roomTemperatureC: 22 }, 1, 'T1'],
  ] as const)('uses the source per-person adjustment for %s', (key, answers, effect, tier) => {
    expect(single(key, { goal: 'sleep', ...answers })).toMatchObject({
      tier,
      adjustedExpectedEffect: effect,
    });
  });
  it('the 0.8 gate is inclusive and lower values permit an optional test', () => {
    const revised = structuredClone(catalog);
    const item = revised.items.find((item) => item.key === 'hot-bath-shower-1-2-h-before-bed')!;
    const check = (effect: number) => {
      item.expectedEffect = effect;
      return createStackRouter(revised)(inventory(item.key), { '0': { goal: 'sleep' } }).items[0]!;
    };
    expect(check(0.8).tier).toBe('T1');
    expect(check(0.799)).toMatchObject({ tier: 'T3_TOO_SMALL', canRunAnyway: true });
    expect(check(0)).toMatchObject({ tier: 'T3_TOO_SMALL', adjustedExpectedEffect: 0 });
  });
  it('never substitutes zero for a missing effect', () => {
    const revised = structuredClone(catalog);
    revised.items.find((item) => item.key === 'hot-bath-shower-1-2-h-before-bed')!.expectedEffect =
      null;
    expect(
      createStackRouter(revised)(inventory('hot-bath-shower-1-2-h-before-bed'), {
        '0': { goal: 'sleep' },
      }).items[0],
    ).toMatchObject({ tier: 'T3', teamQuestions: ['MISSING_EFFECT'] });
  });
  it('slow and special designs never enter the ordinary runnable list', () => {
    const stack = routeStack(inventory('ashwagandha-ksm-66-sensoril', 'thc-cannabis-for-sleep'), {
      '0': { goal: 'sleep', form: 'KSM-66', dose: 300, doseUnit: 'mg' },
      '1': { goal: 'sleep' },
    });
    expect(stack.queued.map((item) => item.tier)).toEqual(['T1_QUEUED_SLOW', 'T1_QUEUED_SPECIAL']);
    expect(stack.runnable).toHaveLength(0);
    expect(stack.queued[1]?.onDays).toBe('observe');
  });
  it('orders by adjusted effect and breaks ties by stable inventory ID', () => {
    const stack = routeStack(
      inventory('coffee-after-2pm', 'alcohol-in-the-evening', 'late-dinner-within-2-3-h-of-bed'),
      {
        '0': { goal: 'sleep', time: '2 to 5pm' },
        '1': { goal: 'sleep', nightsPerWeek: 3 },
        '2': { goal: 'sleep', dinnerToBedMinutes: 60 },
      },
    );
    expect(stack.runnable.map((item) => item.key)).toEqual([
      'alcohol-in-the-evening',
      'coffee-after-2pm',
      'late-dinner-within-2-3-h-of-bed',
    ]);
    expect(stack.runnable[0]?.onDays).toBe('observe');
  });
  it('ratings are offered only when the goal map permits them', () => {
    expect(single('massage-monthly', { goal: 'stress', bankedCredits: 0 })).toMatchObject({
      tier: 'T3',
      teamQuestions: ['RATING_GOALS'],
    });
    expect(
      single('massage-monthly', { goal: 'stress', bankedCredits: 0 }).dailyRating,
    ).toBeUndefined();
    expect(single('collagen-peptides', { goal: 'skin', dose: 10, doseUnit: 'g' }).dailyRating).toBe(
      'skin / hair',
    );
    expect(
      single('collagen-peptides', { goal: 'weight', dose: 10, doseUnit: 'g' }).dailyRating,
    ).toBeUndefined();
  });
  it('a wearable-visible item is not tested for an unrelated invisible goal', () => {
    expect(single('coffee-after-2pm', { goal: 'skin', time: '2 to 5pm' })).toMatchObject({
      tier: 'T3',
      dailyRating: 'skin / hair',
    });
  });
  it('an item-rule metric override cannot bypass an invisible goal', () => {
    expect(single('cold-plunge-ice-bath', { goal: 'skin', time: 'evening' })).toMatchObject({
      tier: 'T3',
      dailyRating: 'skin / hair',
    });
  });
  it('the default number follows the row order rather than catalog metric order', () => {
    expect(single('pre-workout', { goal: 'sleep' }).metric).toBe('Time to fall asleep');
    expect(single('alcohol-in-the-evening', { goal: 'sleep', nightsPerWeek: 3 }).metric).toBe(
      'Overnight HRV',
    );
  });
});

describe('inventory overlap decisions', () => {
  it('covers all 18 source groups with explicit policies', () => {
    expect(Object.keys(overlapPolicies).sort()).toEqual(
      catalog.overlapGroups.map((group) => group.name).sort(),
    );
  });
  it('shows both gyms with cost per visit and suggests dropping the less-used membership', () => {
    const stack = routeStack(inventory('gym-membership', 'yoga-pilates-studio'), {
      '0': { goal: 'fitness', visitsLast30Days: 12 },
      '1': { goal: 'fitness', visitsLast30Days: 4 },
    });
    expect(stack.drops[0]).toMatchObject({
      id: '1',
      reason: 'overlaps with something else',
      overlapIds: ['0'],
    });
    expect(stack.overlaps[0]).toMatchObject({
      itemIds: ['0', '1'],
      keepId: '0',
      status: 'suggested',
    });
    expect(stack.overlaps[0]?.comparisons[0]?.costPerUse).toBeGreaterThan(0);
  });
  it('a user can choose the other gym and the engine retains both', () => {
    const stack = routeStack(
      inventory('gym-membership', 'yoga-pilates-studio'),
      {
        '0': { goal: 'fitness', visitsLast30Days: 12 },
        '1': { goal: 'fitness', visitsLast30Days: 4 },
      },
      { overlapKeep: { 'fitness memberships': '1' } },
    );
    expect(stack.drops.map((item) => item.id)).toEqual(['0']);
    expect(stack.items).toHaveLength(2);
    expect(stack.overlaps[0]?.status).toBe('confirmed');
  });
  it('unknown usage and ties never choose a loser arbitrarily', () => {
    const stack = routeStack(inventory('magnesium-any-form', 'magnesium-l-threonate'), {
      '0': { goal: 'sleep', form: 'glycinate', dose: 400, doseUnit: 'mg elemental' },
      '1': { goal: 'sleep', dose: 2, doseUnit: 'g' },
    });
    expect(stack.drops).toHaveLength(0);
    expect(stack.overlaps.find((group) => group.group === 'magnesium')).toMatchObject({
      status: 'pending',
      needsAnswers: ['overlapKeep'],
    });
  });
  it('does not use an already-dropped or incomplete product as an overlap keeper', () => {
    const stack = routeStack(inventory('omega-3-fish-oil', 'krill-oil'), {
      '0': { goal: 'energy', dose: 300, doseUnit: 'mg EPA+DHA' },
      '1': { goal: 'energy', dose: 1200, doseUnit: 'mg EPA+DHA' },
    });
    expect(stack.drops.map((item) => item.id)).toEqual(['0']);
    expect(stack.items[1]?.tier).toBe('T3');
  });
  it('fish oil is the source-defined keeper when both products pass their own dose floors', () => {
    const stack = routeStack(inventory('omega-3-fish-oil', 'krill-oil'), {
      '0': { goal: 'energy', dose: 1000, doseUnit: 'mg EPA+DHA' },
      '1': { goal: 'energy', dose: 1200, doseUnit: 'mg EPA+DHA' },
    });
    expect(stack.drops).toHaveLength(1);
    expect(stack.drops[0]?.reason).toBe('overlaps with something else');
  });
  it('respects a user keeper choice over the default fish-oil recommendation', () => {
    const stack = routeStack(
      inventory('omega-3-fish-oil', 'krill-oil'),
      {
        '0': { goal: 'energy', dose: 1000, doseUnit: 'mg EPA+DHA' },
        '1': { goal: 'energy', dose: 1200, doseUnit: 'mg EPA+DHA' },
      },
      { overlapKeep: { 'omega-3': '1' } },
    );
    expect(stack.drops.map((item) => item.id)).toEqual(['0']);
    expect(stack.overlaps[0]).toMatchObject({ status: 'confirmed', keepId: '1' });
  });
  it('does not auto-drop massage or wake-up lights merely for sharing a group', () => {
    const stack = routeStack(
      inventory(
        'massage-gun',
        'compression-boots-normatec',
        'sunrise-alarm-hatch-etc',
        'light-therapy-box-10-000-lux',
      ),
      {
        '0': { goal: 'soreness', daysSinceLastUse: 1 },
        '1': { goal: 'soreness', daysSinceLastUse: 1 },
        '2': { goal: 'sleep', daysSinceLastUse: 1 },
        '3': { goal: 'sleep', daysSinceLastUse: 1 },
      },
    );
    expect(stack.drops).toHaveLength(0);
    expect(stack.overlaps.every((group) => group.status === 'informational')).toBe(true);
  });
  it('a protected physical is reference-only and only the duplicate subscription can drop', () => {
    const stack = routeStack(
      inventory('blood-panel-subscription-function-etc', 'annual-physical-with-bloodwork'),
      {
        '0': { goal: 'energy', subscriptionHasAdditionalTests: false },
        '1': {},
      },
    );
    expect(stack.drops[0]).toMatchObject({ id: '0', step: 'overlap' });
    expect(stack.protected[0]).not.toHaveProperty('overlapIds');
    expect(stack.overlaps[0]?.comparisons.map((comparison) => comparison.id)).toEqual(['0']);
  });
  it('melatonin plus gummies drops only the gummies and retains all sleep-aid costs', () => {
    const stack = routeStack(inventory('melatonin', 'sleep-gummies-blend', 'glycine'), {
      '0': { goal: 'sleep', dose: 1, doseUnit: 'mg' },
      '1': { goal: 'sleep', dose: 1, doseUnit: 'mg' },
      '2': { goal: 'sleep', dose: 3, doseUnit: 'g' },
    });
    expect(stack.drops.map((item) => item.id)).toEqual(['1']);
    expect(stack.overlaps.find((group) => group.group === 'sleep aids')?.itemIds).toHaveLength(3);
  });
  it('unknown multivitamin contents never prove a duplicate dose', () => {
    const stack = routeStack(inventory('multivitamin', 'vitamin-d3'), {
      '0': { goal: 'energy' },
      '1': { goal: 'energy', dose: 1000, doseUnit: 'IU' },
    });
    expect(stack.drops).toHaveLength(0);
    expect(stack.overlaps[0]?.needsAnswers).toContain('multiContainsStudiedDose');
  });
  it('an explicitly confirmed duplicate multivitamin dose drops only the separate vitamin', () => {
    const stack = routeStack(inventory('multivitamin', 'vitamin-d3'), {
      '0': { goal: 'energy' },
      '1': { goal: 'energy', dose: 1000, doseUnit: 'IU', multiContainsStudiedDose: true },
    });
    expect(stack.drops.map((item) => item.id)).toEqual(['1']);
  });
  it('keeps Protected vitamins out of overlap comparisons', () => {
    const stack = routeStack(inventory('multivitamin', 'vitamin-d3'), {
      '0': { goal: 'energy' },
      '1': { source: 'doctor' },
    });
    expect(stack.drops).toHaveLength(0);
    expect(stack.overlaps).toHaveLength(0);
  });
  it('electrolyte duplicates are settled after the item rule', () => {
    const stack = routeStack(inventory('electrolytes-lmnt-etc', 'electrolytes-plus-sports-drink'), {
      '0': { goal: 'fitness', trainingMinutesPerDay: 90, keto: false },
      '1': { goal: 'fitness' },
    });
    expect(stack.drops.map((item) => item.id)).toEqual(['1']);
    expect(stack.overlaps[0]?.group).toBe('electrolytes');
  });
  it('an equivalent home heat/cold source must be confirmed before a studio is a duplicate', () => {
    const entries = inventory('sauna-bathhouse-membership', 'cold-plunge-ice-bath-tub-owned');
    const answers: AnswersById = {
      '0': { goal: 'sleep', visitsLast30Days: 3 },
      '1': { goal: 'sleep', time: 'morning', daysSinceLastUse: 1 },
    };
    expect(routeStack(entries, answers).drops).toHaveLength(0);
    expect(
      routeStack(entries, {
        ...answers,
        '0': { ...answers['0'], ownsEquivalentHeatOrCold: true },
      }).drops.map((item) => item.id),
    ).toEqual(['0']);
  });
  it('skincare devices with unresolved weekly cutoffs show a review instead of guessed drops', () => {
    const stack = routeStack(
      inventory('led-face-mask', 'red-light-therapy-panel', 'facials-monthly'),
      {
        '0': { goal: 'skin', daysSinceLastUse: 1, usesLast30Days: 3 },
        '1': { goal: 'skin', daysSinceLastUse: 1, usesLast30Days: 2 },
        '2': { goal: 'skin', stillPaying: true, daysSinceLastUse: 1 },
      },
    );
    expect(stack.drops).toHaveLength(0);
    expect(
      stack.overlaps.find((group) => group.group === 'professional skin treatments')?.needsAnswers,
    ).toContain('SKIN_USAGE_THRESHOLD');
  });
  it('unconfirmed same-night exfoliation does not become a name-only drop', () => {
    const stack = routeStack(
      inventory(
        'retinol-or-retinoid-plus-exfoliating-acid-on-the-same-nights',
        'two-exfoliants-scrub-plus-acid-or-two-acids',
      ),
      {
        '0': { goal: 'skin' },
        '1': { goal: 'skin' },
      },
    );
    expect(stack.drops).toHaveLength(0);
    expect(stack.overlaps[0]?.needsAnswers).toContain('sameNightExfoliation');
  });
  it('caffeine overlap requires confirmed timing rather than product names alone', () => {
    const entries = inventory('pre-workout', 'coffee-after-2pm');
    const a: AnswersById = { '0': { goal: 'sleep' }, '1': { goal: 'sleep', time: '2 to 5pm' } };
    expect(routeStack(entries, a).drops).toHaveLength(0);
    expect(routeStack(entries, a).runnable).toHaveLength(0);
    expect(routeStack(entries, a).items[1]).toMatchObject({
      tier: 'T3',
      detail: 'overlap_review_required',
    });
    expect(
      routeStack(entries, { ...a, '0': { ...a['0'], caffeineWithinHourOfCoffee: true } }).drops.map(
        (item) => item.id,
      ),
    ).toEqual(['0']);
  });
});

describe('accounting, input contracts and source acceptance', () => {
  it('uses actual editable costs and sums in cents', () => {
    const stack = routeStack(
      [
        { id: 'a', key: 'gaba-oral', monthlyCost: 0.1 },
        { id: 'b', key: 'bcaas', monthlyCost: 0.2 },
      ],
      { a: { goal: 'sleep' }, b: { goal: 'fitness' } },
    );
    expect(stack.summary).toMatchObject({
      itemsOnArrival: 2,
      monthlyTotal: 0.3,
      monthlyBack: 0.3,
      annualBack: 3.6,
    });
  });
  it('Protected costs are opt-in and never appear on their routed records', () => {
    const entries: InventoryItem[] = [{ id: 'p', key: 'custom-prescription', monthlyCost: 50 }];
    expect(routeStack(entries, { p: { prescription: true } }).summary.monthlyTotal).toBe(0);
    expect(
      routeStack([{ ...entries[0]!, includeProtectedInSummary: true }], {
        p: { prescription: true },
      }).summary.monthlyTotal,
    ).toBe(50);
  });
  it('does not mutate inventory, answers or catalog and is deterministic', () => {
    const entries = Object.freeze(workedInventory.map((entry) => Object.freeze({ ...entry })));
    const answers = Object.freeze(structuredClone(workedAnswers));
    const before = JSON.stringify({ entries, answers, catalog });
    expect(routeStack(entries, answers)).toEqual(routeStack(entries, answers));
    expect(JSON.stringify({ entries, answers, catalog })).toBe(before);
  });
  it('every arrival has exactly one summary bucket', () => {
    const stack = routeStack(workedInventory, workedAnswers);
    expect(
      stack.drops.length +
        stack.runnable.length +
        stack.queued.length +
        stack.cantMeasure.length +
        stack.keep.length +
        stack.protected.length +
        stack.excluded.length,
    ).toBe(21);
  });
  it('all conditional source-conflict keys exist and stay conservative', () => {
    for (const key of conditionalSourceConflicts) {
      expect(catalog.items.some((item) => item.key === key)).toBe(true);
      const item = catalog.items.find((item) => item.key === key)!;
      expect(single(key, { goal: 'skin' })).toMatchObject(
        item.tier === 'PROTECTED'
          ? { tier: 'PROTECTED' }
          : { tier: 'T3', teamQuestions: ['COLUMN_CONFLICTS'] },
      );
    }
  });
  it('passes the golden example: 21 items, $1,428, 10 drops, $767 back, 4 lined up', () => {
    const { issues, stack } = inspectWorkedExample(catalog);
    expect(issues).toEqual([]);
    expect(stack.summary).toMatchObject({
      itemsOnArrival: 21,
      monthlyTotal: 1428,
      dropsToday: 10,
      monthlyBack: 767,
      linedUpForTesting: 4,
      cantMeasure: 2,
      keep: 4,
    });
    expect(stack.runnable.map((item) => item.id)).toEqual(['alcohol', 'coffee', 'training', 'dinner']);
    expect(assertWorkedExample(catalog).summary.monthlyBack).toBe(767);
  });
  it('rejects unknown ordinary items, duplicate IDs, invalid costs and foreign answers', () => {
    expect(() => single('unknown', { goal: 'sleep' })).toThrow('Unknown catalog item');
    expect(() =>
      routeStack(
        [
          { id: 'x', key: 'gaba-oral' },
          { id: 'x', key: 'bcaas' },
        ],
        {},
      ),
    ).toThrow('duplicate inventory ID');
    expect(() => routeStack([{ id: 'x', key: 'gaba-oral', monthlyCost: NaN }], {})).toThrow(
      'Invalid monthly cost',
    );
    expect(() => routeStack([], { foreign: { goal: 'sleep' } })).toThrow('unknown inventory ID');
    expect(() => single('gaba-oral', { goal: 'sleep', usesLast30Days: 0.5 })).toThrow(
      'whole count',
    );
  });
  it('rejects overlap choices outside the matching group', () => {
    expect(() =>
      routeStack(
        inventory('magnesium-any-form', 'magnesium-l-threonate'),
        {
          '0': { goal: 'sleep', form: 'glycinate', dose: 400, doseUnit: 'mg elemental' },
          '1': { goal: 'sleep', dose: 2, doseUnit: 'g' },
        },
        { overlapKeep: { magnesium: 'other-user-id' } },
      ),
    ).toThrow('Invalid overlap choice');
    expect(() => routeStack([], {}, { overlapKeep: { 'invented-group': '0' } })).toThrow(
      'Unknown overlap group',
    );
  });
});
