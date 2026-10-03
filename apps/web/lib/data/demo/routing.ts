import type { DropReason, Tier } from '@distill/catalog';

/**
 * Where each Worked Example item lands, transcribed from the sheet's "Where it lands" column.
 * This is a fixture shaped like the Phase 3 router's output, not a router: when routeStack
 * lands, this table goes and the screen stays. Keys are catalog keys; the Oura ring has none.
 */
export interface DemoLanding {
  tier: Tier;
  reason?: DropReason;
  keep?: boolean;
  canRunAnyway?: boolean;
  /** The rule's adjusted expected effect, where the sheet gives one. */
  expectedEffect?: number;
  /** The place in the experiment queue, from the sheet's notes. */
  order?: number;
  observeOnly?: boolean;
  dailyRating?: string;
  /** The sheet's note for the row, for the record. */
  note: string;
}

export const demoRouting: Record<string, DemoLanding> = {
  'premium-gym-membership-equinox-life-time': { tier: 'T3', keep: true, note: 'Going. $23 a visit.' },
  'boutique-class-membership-barry-s-soulcycle-f45-orangetheory': {
    tier: 'T2',
    reason: 'overlaps with something else',
    note: 'Two memberships, one used. Keep Equinox.',
  },
  'recovery-studio-membership-restore-remedy-place-othership': {
    tier: 'T2',
    reason: 'not being used',
    note: '$250 for one visit.',
  },
  'massage-membership-massage-envy-squeeze': {
    tier: 'T2',
    reason: 'not being used',
    note: 'Use the credits, pause the billing.',
  },
  'meditation-app-calm-headspace': {
    tier: 'T2',
    reason: 'not being used',
    note: "Resubscribe the week it's wanted.",
  },
  'fitness-app-subscription-peloton-app-apple-fitness-ladder': { tier: 'T3', keep: true, note: 'Used.' },
  'greens-powder-ag1-etc': { tier: 'T3', note: '$1,080 a year shown. Their call.' },
  'magnesium-any-form': { tier: 'T2', reason: 'dose too low', note: 'Below 200 mg. Step up or drop.' },
  'collagen-drinks-and-beauty-gummies': {
    tier: 'T2',
    reason: 'dose too low',
    note: 'Trials used 10 g. Powder if they want it.',
  },
  'omega-3-fish-oil': { tier: 'T2', reason: 'dose too low', note: 'Below 500 mg.' },
  'vitamin-c-serum': { tier: 'T2', reason: 'form not absorbed', note: 'Already oxidised.' },
  'toner-hydrating-or-balancing': {
    tier: 'T2',
    reason: 'overlaps with something else',
    note: 'The serum does this.',
  },
  'eye-cream-when-you-already-use-a-moisturiser': {
    tier: 'T2',
    reason: 'overlaps with something else',
    note: 'Same formula, smaller jar.',
  },
  'retinol-retinoid-nightly': { tier: 'T3', keep: true, dailyRating: 'skin', note: 'Strong evidence. Weekly skin rating.' },
  'sunscreen-daily-spf-30': { tier: 'T3', keep: true, note: 'Strongest evidence on the list.' },
  'facials-monthly': { tier: 'T3', dailyRating: 'skin', note: '$1,800 a year shown; skin rating offered.' },
  'coffee-after-2pm': { tier: 'T1', expectedEffect: 1.0, order: 1, note: 'First experiment. Expected effect 1.0.' },
  'alcohol-in-the-evening': {
    tier: 'T1',
    expectedEffect: 1.5,
    order: 2,
    observeOnly: true,
    note: 'Second experiment. Expected effect 1.5.',
  },
  'training-after-7pm': {
    tier: 'T1',
    expectedEffect: 1.0,
    order: 3,
    note: 'Third experiment; day-one hypothesis from 6 months of history.',
  },
  'late-dinner-within-2-3-h-of-bed': { tier: 'T1', expectedEffect: 0.8, order: 4, note: 'Fourth in the queue.' },
};

/** The one pair in the demo stack that the engine would show side by side. */
export const demoOverlaps = [
  {
    group: 'fitness memberships',
    keys: [
      'premium-gym-membership-equinox-life-time',
      'boutique-class-membership-barry-s-soulcycle-f45-orangetheory',
    ] as [string, string],
    suggestedDrop: 'boutique-class-membership-barry-s-soulcycle-f45-orangetheory',
    facts: {
      'premium-gym-membership-equinox-life-time': '11 visits last month',
      'boutique-class-membership-barry-s-soulcycle-f45-orangetheory': '2 visits last month',
    },
    visits: {
      'premium-gym-membership-equinox-life-time': 11,
      'boutique-class-membership-barry-s-soulcycle-f45-orangetheory': 2,
    },
  },
];

/**
 * The day-one hypothesis for training after 7pm: the "Tier 1, day-one hypothesis from history"
 * template's own example, word for word (Verdict Templates!C5). The fixture does not fill the
 * template itself; that is Phase 7.
 */
export const demoHypotheses: Record<string, string> = {
  'training-after-7pm':
    "Training after 7pm: on the 22 nights in the last six months when you trained late, your total sleep was 34 minutes shorter than the other 140 nights. That's a pattern, not proof yet; other things differed on those nights too. Want to test it properly?",
};
