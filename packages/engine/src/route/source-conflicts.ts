/** TODO(team): AC describes conditions while AG says name-only. Do not select a column silently. */
export const conditionalSourceConflicts = new Set([
  'zma',
  'flaxseed-oil-as-omega-3',
  'coq10',
  'digestive-enzymes',
  'apple-cider-vinegar',
  'grounding-earthing-sheets-mats',
  'sleep-coach-cbt-i',
  'premium-gym-membership-equinox-life-time',
  'boutique-class-membership-barry-s-soulcycle-f45-orangetheory',
  'class-pack-or-studio-credits',
  'fitness-app-subscription-peloton-app-apple-fitness-ladder',
  'recovery-studio-membership-restore-remedy-place-othership',
  'massage-membership-massage-envy-squeeze',
  'meal-delivery-or-meal-prep-service',
  'nutrition-or-calorie-app-premium',
  'collagen-drinks-and-beauty-gummies',
  'vitamin-c-serum',
  'eye-cream-when-you-already-use-a-moisturiser',
  'retinol-or-retinoid-plus-exfoliating-acid-on-the-same-nights',
  'facial-plus-at-home-led-plus-microcurrent-all-three',
  'microcurrent-device-nuface',
  'unlisted-device-you-haven-t-used-in-30-days',
  'unlisted-subscription-you-re-still-paying-for',
]);
/** Unconditional keep statements, transcribed explicitly rather than parsing source prose. */
export const unconditionalKeeps = new Set([
  'psyllium-fibre',
  'strength-training',
  'water-filter',
  'sunscreen-daily-spf-30',
  'retinol-retinoid-nightly',
]);
