import type { ItemRule } from './types.js';
import {
  ambiguous,
  dose,
  drop,
  keep,
  missing,
  notHypothesis,
  paidUsage,
  protectedItem,
  small,
  t1,
  t3,
  twoMonthFloor,
  unused,
  usage,
  visitFloor,
} from './helpers.js';

// Hand-transcribed from Items!AG. No natural-language parsing at runtime.
// TODO(team): resolve the documented boundary gaps and conflicting fields in OPEN_QUESTIONS.md.
export const itemRules = {
  'magnesium-any-form': (a) => {
    if (['oxide', 'spray', 'spray or oil'].includes(a.form ?? '')) return drop('form not absorbed');
    if (!['glycinate', 'citrate', 'malate', 'threonate'].includes(a.form ?? ''))
      return missing('form');
    return dose(
      a,
      200,
      'mg elemental',
      a.goal === 'sleep' ? small() : a.goal ? t3() : missing('goal'),
    );
  },
  'magnesium-l-threonate': (a) => dose(a, 1, 'g', small()),
  melatonin: (a) => {
    if (a.dose === undefined || a.doseUnit !== 'mg') return missing('dose', 'doseUnit');
    return t1(undefined, {
      notes: a.dose > 1 ? ['LESS_IS_MORE'] : [],
      safetyNoteRequired: a.dose > 5,
    });
  },
  'l-theanine': (a) => dose(a, 100, 'mg', small()),
  glycine: (a) => dose(a, 1, 'g', small()),
  'ashwagandha-ksm-66-sensoril': (a) => {
    if (a.form === 'plain root powder') return dose(a, 1000, 'mg', { tier: 'T1_QUEUED_SLOW' });
    if (['KSM-66', 'Sensoril', 'other extract'].includes(a.form ?? ''))
      return dose(a, 250, 'mg', { tier: 'T1_QUEUED_SLOW' });
    return missing('form');
  },
  valerian: (a) => dose(a, 300, 'mg', small()),
  'tart-cherry-juice-extract': (a) =>
    a.form === 'juice'
      ? dose(a, 240, 'ml', small())
      : a.form === 'extract'
        ? dose(a, 480, 'mg', small())
        : missing('form'),
  cbd: (a) =>
    a.onMedication === true
      ? protectedItem()
      : a.onMedication === undefined
        ? missing('onMedication')
        : dose(a, 25, 'mg', small()),
  kava: (a) =>
    a.liverCondition
      ? protectedItem()
      : a.alcoholMostNights
        ? t3({ safetyNoteRequired: true })
        : a.alcoholMostNights === undefined || a.liverCondition === undefined
          ? missing('alcoholMostNights', 'liverCondition')
          : small(),
  '5-htp': (a) =>
    a.onAntidepressant === true
      ? protectedItem()
      : a.onAntidepressant === undefined
        ? missing('onAntidepressant')
        : dose(a, 100, 'mg', small()),
  'lavender-oil-oral-silexan': (a) =>
    !a.form || a.form === 'not sure'
      ? missing('form')
      : a.form === 'Silexan 80 mg'
        ? small()
        : { ...drop('form not absorbed'), safetyNoteRequired: true },
  'sleep-gummies-blend': (a) => {
    if (a.dose === undefined || a.doseUnit !== 'mg') return missing('dose', 'doseUnit');
    return small({
      ...(a.dose === 0
        ? { relatedExperiment: 'sleep-tea-blend-valerian-passionflower-lemon-balm' }
        : {}),
      notes: a.dose > 3 ? ['LESS_IS_MORE'] : [],
    });
  },
  'vitamin-d3': (a) =>
    a.dose === undefined || a.doseUnit !== 'IU'
      ? missing('dose', 'doseUnit')
      : t3({ safetyNoteRequired: a.dose > 10000 }),
  'vitamin-b12': (a) => {
    if (
      a.vegan ||
      a.vegetarian ||
      (a.age !== undefined && a.age > 60) ||
      a.onMetformin ||
      a.onAcidReducers
    )
      return t3({ notes: ['GET_A_LEVEL'] });
    if (a.age === 60) return ambiguous('B12_AGE_60');
    if ([a.vegan, a.vegetarian, a.age, a.onMetformin, a.onAcidReducers].includes(undefined))
      return missing('vegan', 'vegetarian', 'age', 'onMetformin', 'onAcidReducers');
    return drop('tested, found nothing');
  },
  'omega-3-fish-oil': (a) =>
    dose(
      a,
      500,
      'mg EPA+DHA',
      t3({ notes: a.dose !== undefined && a.dose < 1000 ? ['BELOW_STUDIED_DOSE'] : [] }),
    ),
  'krill-oil': (a) => dose(a, 1000, 'mg EPA+DHA', t3()),
  'creatine-monohydrate': (a) =>
    dose(
      a,
      2,
      'g',
      t3({
        keep: true,
        notes: ['HCl', 'buffered', 'blend', 'creatine blend'].includes(a.form ?? '')
          ? ['MONOHYDRATE_STUDIED_FORM']
          : [],
      }),
    ),
  'protein-powder': () => t3(),
  'beta-alanine': (a) => dose(a, 2, 'g', t3({ notes: ['ONE_TO_FOUR_MINUTE_EFFORTS'] })),
  'electrolytes-lmnt-etc': (a) =>
    a.keto || (a.trainingMinutesPerDay !== undefined && a.trainingMinutesPerDay > 60)
      ? keep()
      : a.keto === undefined || a.trainingMinutesPerDay === undefined
        ? missing('keto', 'trainingMinutesPerDay')
        : t3({ notes: ['WATER_DOES_THIS'] }),
  'greens-powder-ag1-etc': () =>
    t3({ notes: ['ANNUAL_COST'], overlapCheck: ['daily multivitamin'] }),
  'collagen-peptides': (a) =>
    dose(
      a,
      5,
      'g',
      t3({
        dailyRating: a.goal === 'pain' ? 'pain' : 'skin',
        notes: a.dose !== undefined && a.dose < 10 ? ['BELOW_STUDIED_DOSE'] : [],
      }),
    ),
  'hyaluronic-acid-oral': (a) => dose(a, 120, 'mg', t3({ dailyRating: 'skin' })),
  'turmeric-curcumin': (a) =>
    ['plain turmeric', 'plain turmeric powder', 'spice capsule'].includes(a.form ?? '')
      ? drop('form not absorbed')
      : ['curcumin with piperine', 'phytosome', 'phytosome / Meriva', 'micellar'].includes(
            a.form ?? '',
          )
        ? t3({ dailyRating: 'pain' })
        : missing('form'),
  'glucosamine-chondroitin': (a) => dose(a, 1000, 'mg', t3({ dailyRating: 'pain' })),
  'nmn-nr': () => t3({ notes: ['ANNUAL_COST'] }),
  rhodiola: (a) => dose(a, 200, 'mg', t3({ dailyRating: 'energy' })),
  saffron: (a) => dose(a, 30, 'mg', t3({ dailyRating: 'mood' })),
  'zinc-daily': (a) => {
    if (a.deficiency) return protectedItem();
    const safety = {
      safetyNoteRequired: a.dose !== undefined && a.doseUnit === 'mg' && a.dose > 40,
    };
    if (a.form === 'lozenges when ill') return { ...keep(), ...safety };
    if (a.form !== 'daily' || a.deficiency === undefined)
      return { ...missing('form', 'deficiency'), ...safety };
    return { ...drop('tested, found nothing'), ...safety };
  },
  'vitamin-c-daily': () => t3(),
  elderberry: () => t3(),
  'probiotic-generic-daily': (a) =>
    a.form === 'named strain'
      ? a.namedProblem === true
        ? keep()
        : a.namedProblem === false
          ? t3({ dailyRating: 'gut' })
          : missing('namedProblem')
      : ['generic blend', 'not sure'].includes(a.form ?? '')
        ? t3({ dailyRating: 'gut' })
        : missing('form'),
  berberine: (a) =>
    a.onMedication || a.diabetes || a.prediabetes
      ? protectedItem()
      : [a.onMedication, a.diabetes, a.prediabetes].includes(undefined)
        ? missing('onMedication', 'diabetes', 'prediabetes')
        : dose(a, 1000, 'mg', t3()),
  'coffee-after-2pm': (a) =>
    a.time === 'before noon'
      ? notHypothesis()
      : a.time === '12 to 2pm'
        ? small({ expectedEffect: 0.6 })
        : ['2 to 5pm', 'after 5pm'].includes(a.time ?? '')
          ? t1()
          : missing('time'),
  'second-or-third-coffee': (a) =>
    a.cupsPerDay === undefined
      ? missing('cupsPerDay')
      : a.cupsPerDay <= 1
        ? notHypothesis()
        : a.cupsPerDay === 2
          ? small()
          : a.cupsPerDay >= 3
            ? t1(0.8)
            : ambiguous('FRACTIONAL_COFFEE'),
  'energy-drinks': (a) =>
    a.time === 'after 2pm'
      ? t1(1)
      : ['before noon', '12 to 2pm', 'before 2pm'].includes(a.time ?? '')
        ? small()
        : missing('time'),
  'decaf-swap-after-noon': () => t3({ relatedExperiment: 'coffee-after-2pm', notHypothesis: true }),
  'matcha-green-tea-in-the-afternoon': (a) =>
    a.time === 'after 2pm' ? small() : a.time === 'before 2pm' ? notHypothesis() : missing('time'),
  'alcohol-in-the-evening': (a) =>
    a.nightsPerWeek === undefined
      ? missing('nightsPerWeek')
      : a.nightsPerWeek === 0
        ? t3({ excludeFromInventory: true })
        : a.nightsPerWeek <= 2
          ? t1(1.5, { suggestedWeeks: [3, 4] })
          : t1(1.5, { suggestedWeeks: [2, 2] }),
  'late-dinner-within-2-3-h-of-bed': (a) =>
    a.dinnerToBedMinutes === undefined
      ? missing('dinnerToBedMinutes')
      : a.dinnerToBedMinutes < 90
        ? t1(0.8)
        : a.dinnerToBedMinutes === 90
          ? ambiguous('DINNER_90_MINUTES')
          : a.dinnerToBedMinutes <= 180
            ? small()
            : notHypothesis(),
  'fluids-after-8pm': (a) =>
    a.bathroomNightsPerWeek === undefined
      ? missing('bathroomNightsPerWeek')
      : a.bathroomNightsPerWeek >= 4
        ? t1(1)
        : a.bathroomNightsPerWeek <= 2
          ? small()
          : ambiguous('BATHROOM_THREE_NIGHTS'),
  'nicotine-pouches-vape': (a) =>
    a.time === 'daytime only'
      ? notHypothesis()
      : ['some after 6pm', 'mostly evening'].includes(a.time ?? '')
        ? t1()
        : missing('time'),
  'training-after-7pm': (a) => {
    if (a.vigorous === false || (a.workoutEndHour !== undefined && a.workoutEndHour < 20))
      return small({ expectedEffect: 0.4 });
    if (
      a.vigorous &&
      a.workoutToBedMinutes !== undefined &&
      a.workoutToBedMinutes <= 120 &&
      a.workoutNightsPerWeek !== undefined &&
      a.workoutNightsPerWeek >= 3 &&
      a.workoutEndHour !== undefined
    )
      return t1(1);
    return missing('vigorous', 'workoutToBedMinutes', 'workoutNightsPerWeek', 'workoutEndHour');
  },
  'hiit-in-the-evening': (a) =>
    a.workoutToBedMinutes === undefined
      ? missing('workoutToBedMinutes')
      : a.workoutToBedMinutes <= 120
        ? t1()
        : notHypothesis(),
  'cold-plunge-ice-bath': (a) =>
    a.time === 'evening'
      ? small({ metric: 'Time to fall asleep', notes: ['PRE_PURCHASE_PROXY'] })
      : a.time === 'morning'
        ? small({ metric: 'Overnight HRV', notes: ['PRE_PURCHASE_PROXY'] })
        : missing('time'),
  'sauna-post-workout-or-evening': (a) =>
    a.time === 'evening'
      ? t1(undefined, { metric: 'Time to fall asleep' })
      : ['morning', 'midday'].includes(a.time ?? '')
        ? small({ metric: 'Overnight HRV', expectedEffect: 0.5 })
        : missing('time'),
  'hot-bath-shower-1-2-h-before-bed': () => t1(undefined, { notes: ['SAUNA_STAND_IN'] }),
  'meditation-app-calm-headspace': (a) =>
    paidUsage(a, small({ overlapCheck: ['meditation apps'] })),
  'journaling-worry-list-before-bed': () => t1(),
  'screens-phone-in-bed': (a) =>
    a.phoneNightsPerWeek === undefined
      ? missing('phoneNightsPerWeek')
      : a.phoneNightsPerWeek >= 6
        ? t1()
        : a.phoneNightsPerWeek <= 2
          ? notHypothesis()
          : ambiguous('PHONE_THREE_TO_FIVE_NIGHTS'),
  'consistent-wake-time-30-min': (a) =>
    a.wakeSpreadMinutes === undefined
      ? missing('wakeSpreadMinutes')
      : a.wakeSpreadMinutes > 60
        ? t1()
        : a.wakeSpreadMinutes < 30
          ? keep()
          : ambiguous('WAKE_SPREAD_30_TO_60'),
  'weekend-sleep-in-over-1-h': (a) =>
    a.weekendDelayMinutes === undefined
      ? missing('weekendDelayMinutes')
      : a.weekendDelayMinutes > 60
        ? small({ notes: ['WEEKLY_BLOCKS_ONLY'] })
        : notHypothesis(),
  'afternoon-nap-after-3pm-or-over-30-min': (a) =>
    a.napDaysPerWeek === undefined || a.napMinutes === undefined || a.napHour === undefined
      ? missing('napDaysPerWeek', 'napMinutes', 'napHour')
      : a.napDaysPerWeek >= 3 && (a.napHour > 15 || a.napMinutes > 30)
        ? t1()
        : notHypothesis(),
  'weighted-blanket': (a) => usage(a, small()),
  'mouth-tape': (a) => {
    if (a.possibleSleepApnoea || a.gaspingOrChoking || a.comfortableNasalBreathing === false)
      return protectedItem();
    if (unused(a) === true) return drop('not being used');
    if (
      [a.possibleSleepApnoea, a.gaspingOrChoking, a.comfortableNasalBreathing, a.snores].includes(
        undefined,
      )
    )
      return missing(
        'possibleSleepApnoea',
        'gaspingOrChoking',
        'comfortableNasalBreathing',
        'snores',
      );
    return usage(a, a.snores ? t1(0.8, { safetyNoteRequired: true }) : t3());
  },
  'nasal-strips-dilator': (a) =>
    usage(a, a.blockedNose || a.snores ? small({ expectedEffect: 0.7 }) : t3()),
  'blue-light-blocking-glasses': (a) => usage(a, small()),
  'eye-mask': (a) =>
    usage(a, t3({ overlapCheck: a.blackedOutRoom ? ['blackout-light-leak'] : [] })),
  earplugs: (a) => usage(a, a.noisyRoom || a.snoringPartner ? t1(1) : t3()),
  'white-noise-sound-machine': (a) =>
    usage(
      a,
      t3({
        notes: a.noisyRoom === false ? ['MAY_DO_THE_OPPOSITE'] : [],
        overlapCheck: ['earplugs'],
      }),
    ),
  'sleep-headphones-sleep-stories': (a) => usage(a, t3()),
  'sunrise-alarm-hatch-etc': (a) => usage(a, t3({ overlapCheck: ['wake-up light'] })),
  'light-therapy-box-10-000-lux': (a) =>
    usage(
      a,
      a.goal === 'mood'
        ? t3({ dailyRating: 'mood', overlapCheck: ['wake-up light'] })
        : a.goal === 'sleep'
          ? small({ overlapCheck: ['wake-up light'] })
          : t3(),
    ),
  'red-light-therapy-panel': (a) =>
    usage(
      a,
      a.goal === 'skin'
        ? t3({ dailyRating: 'skin', overlapCheck: ['at-home skin devices'] })
        : ambiguous('RED_LIGHT_GOALS'),
    ),
  'eight-sleep-cooling-mattress-pad': (a) => paidUsage(a, a.sleepsHot ? t1(0.9) : t3(), 30, true),
  'massage-gun': (a) => usage(a, t3({ dailyRating: 'soreness' })),
  'compression-boots-normatec': (a) => usage(a, t3()),
  'continuous-glucose-monitor-no-diabetes': (a) =>
    a.diabetes || a.prediabetes ? protectedItem() : t3({ notes: ['ANNUAL_COST'] }),
  'second-wearable-oura-plus-whoop': (a) =>
    a.bothWearables
      ? { ...drop('overlaps with something else'), overlapCheck: ['wearables'] }
      : a.bothWearables === false
        ? t3()
        : missing('bothWearables'),
  'air-purifier-bedroom': (a) =>
    usage(a, a.allergies || a.heavyTraffic ? small({ expectedEffect: 0.7 }) : t3(), 30, true),
  humidifier: (a) => usage(a, t3(), 30, true),
  'vibration-plate': (a) =>
    usage(a, a.goal === 'fat loss' ? drop('tested, found nothing') : t3(), 30, true),
  'led-face-mask': (a) =>
    usage(a, t3({ dailyRating: 'skin', overlapCheck: ['at-home skin devices'] }), 30, true),
  'jaw-exerciser': () => ({ ...drop('no way it could work'), safetyNoteRequired: true }),
  'smart-lights-warm-dim-in-the-evening': () => small(),
  'sauna-bathhouse-membership': (a) =>
    visitFloor(a, 2, t1(undefined, { overlapCheck: ['heat and cold'] })),
  'cryotherapy-sessions': (a) =>
    a.visitsLast60Days === 0 && a.packageUnused
      ? drop('not being used')
      : a.visitsLast60Days === undefined || a.packageUnused === undefined
        ? missing('visitsLast60Days', 'packageUnused')
        : small({ overlapCheck: ['heat and cold'] }),
  'iv-vitamin-drips': () => drop('tested, found nothing'),
  'massage-monthly': (a) =>
    a.bankedCredits === undefined
      ? missing('bankedCredits')
      : a.bankedCredits > 0
        ? usage(a, t3({ dailyRating: 'stress', overlapCheck: ['massage'] }), 60, true)
        : t3({ dailyRating: 'stress', overlapCheck: ['massage'] }),
  'facials-monthly': (a) =>
    paidUsage(
      a,
      t3({ dailyRating: 'skin', overlapCheck: ['professional skin treatments'] }),
      90,
      true,
    ),
  acupuncture: (a) =>
    unused(a, 90, true) === true
      ? t3({ excludeFromInventory: true })
      : unused(a, 90, true) === undefined
        ? missing('daysSinceLastUse')
        : ambiguous('ACUPUNCTURE_GOAL'),
  'chiropractor-maintenance-visits': (a) =>
    a.currentPain === true
      ? t3({ dailyRating: 'pain' })
      : a.currentPain === false
        ? t3({ notes: ['MAINTENANCE_NO_EVIDENCE'] })
        : missing('currentPain'),
  'personal-trainer': (a) => {
    if (a.visitsLast30Days === undefined) return missing('visitsLast30Days');
    if (a.visitsLast30Days >= 2) return keep();
    if (a.visitsPrevious30Days === undefined) return missing('visitsPrevious30Days');
    return a.visitsPrevious30Days < 2 ? t3({ notes: ['COST_PER_SESSION'] }) : keep();
  },
  'nutritionist-dietitian': () => protectedItem(),
  'gym-membership': (a) =>
    twoMonthFloor(
      a,
      4,
      a.visitsLast30Days !== undefined && a.visitsLast30Days >= 8
        ? keep()
        : t3({ notes: ['COST_PER_VISIT'], overlapCheck: ['fitness memberships'] }),
    ),
  'yoga-pilates-studio': (a) =>
    twoMonthFloor(a, 4, t3({ keep: true, overlapCheck: ['fitness memberships'] })),
  'float-tank': (a) =>
    a.packageUnused
      ? usage(a, t3(), 60, true)
      : a.packageUnused === false
        ? t3()
        : missing('packageUnused'),
  'blood-panel-subscription-function-etc': (a) => {
    if (a.inventoryKeys === undefined) return missing('inventoryKeys');
    if (!a.inventoryKeys.includes('annual-physical-with-bloodwork')) return t3();
    return a.subscriptionHasAdditionalTests === true
      ? t3()
      : a.subscriptionHasAdditionalTests === false
        ? { ...drop('overlaps with something else'), overlapCheck: ['bloodwork'] }
        : missing('subscriptionHasAdditionalTests');
  },
  'stretch-studio-assisted-stretching': (a) => visitFloor(a, 2, t3()),
  'retreat-wellness-weekend': () => t3(),
  'bedroom-temperature-thermostat': (a) =>
    a.sleepsHot || (a.roomTemperatureC !== undefined && a.roomTemperatureC > 21)
      ? t1(1)
      : a.sleepsHot === undefined || a.roomTemperatureC === undefined
        ? missing('sleepsHot', 'roomTemperatureC')
        : small(),
  'blackout-light-leak': () => small({ overlapCheck: ['eye-mask'] }),
  'phone-charging-in-the-bedroom': () =>
    t3({ relatedExperiment: 'screens-phone-in-bed', notHypothesis: true }),
  'cold-plunge-ice-bath-tub-owned': (a) =>
    usage(
      a,
      a.time === 'evening'
        ? small({ metric: 'Time to fall asleep' })
        : a.time === 'morning'
          ? small({ metric: 'Overnight HRV' })
          : missing('time'),
      30,
      true,
    ),
} satisfies Record<string, ItemRule>;
