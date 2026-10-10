/**
 * What a person sees for an item: a short label, not the routing table's full row name. The full
 * name ("Premium gym membership (Equinox, Life Time)") stays the engine's; screens show "Premium
 * gym", or the brand the person typed ("Equinox"). TODO(team): a "Short name" column in the
 * workbook would move these into the source.
 */
const overrides: Record<string, string> = {
  'premium-gym-membership-equinox-life-time': 'Premium gym',
  'boutique-class-membership-barry-s-soulcycle-f45-orangetheory': 'Boutique classes',
  'recovery-studio-membership-restore-remedy-place-othership': 'Recovery studio',
  'massage-membership-massage-envy-squeeze': 'Massage membership',
  'fitness-app-subscription-peloton-app-apple-fitness-ladder': 'Fitness app',
  'meditation-app-calm-headspace': 'Meditation app',
  'greens-powder-ag1-etc': 'Greens powder',
  'second-gym-or-studio-membership': 'Second membership',
  'class-pack-or-studio-credits': 'Class credits',
  'sauna-or-cold-plunge-studio-when-you-own-one-at-home': 'Sauna studio',
  'meal-delivery-or-meal-prep-service': 'Meal delivery',
  'nutrition-or-calorie-app-premium': 'Nutrition app',
  'second-meditation-or-sleep-app': 'Second sleep app',
  'annual-physical-with-bloodwork': 'Annual physical',
  'collagen-drinks-and-beauty-gummies': 'Collagen gummies',
  'hair-growth-gummies-biotin-blends': 'Hair gummies',
  'retinol-or-retinoid-plus-exfoliating-acid-on-the-same-nights': 'Retinoid plus acid',
  'multiple-hydrating-serums-two-hyaluronic-acid-products': 'Two hydrating serums',
  'facial-plus-at-home-led-plus-microcurrent-all-three': 'Facial, LED and microcurrent',
  'cold-plunge-ice-bath-tub-owned': 'Home cold plunge',
  'unlisted-device-you-haven-t-used-in-30-days': 'Unused device',
  'unlisted-subscription-you-re-still-paying-for': 'Unused subscription',
  'facials-monthly': 'Monthly facial',
  'massage-monthly': 'Monthly massage',
  'yoga-pilates-studio': 'Yoga or Pilates',
  'sauna-bathhouse-membership': 'Sauna membership',
  'hormone-peptide-clinic-trt-glp-1-peptides': 'Hormone clinic',
  'hydrogen-alkaline-water': 'Alkaline water',
  'screens-phone-in-bed': 'Phone in bed',
  'blackout-light-leak': 'Light in the bedroom',
  'alcohol-in-the-evening': 'Evening drinks',
  'training-after-7pm': 'Late workouts',
  'morning-workout-before-8am': 'Early workouts',
  'late-dinner-within-2-3-h-of-bed': 'Late dinner',
  'dessert-sugar-before-bed': 'Dessert before bed',
  'big-carbohydrate-dinner': 'Big carb dinner',
  'cold-shower-morning': 'Cold showers',
  'hot-bath-shower-1-2-h-before-bed': 'Hot bath before bed',
  'checking-the-sleep-score-every-morning': 'Morning sleep score',
  'continuous-glucose-monitor-no-diabetes': 'Glucose monitor',
  'mattress-age-over-8-years': 'Old mattress',
  'lavender-oil-oral-silexan': 'Lavender capsules',
  'matcha-green-tea-in-the-afternoon': 'Afternoon matcha',
  'stretching-yoga-before-bed': 'Evening stretching',
  'reading-paper-before-bed': 'Reading before bed',
  'nootropic-stack-alpha-gpc-etc': 'Nootropics',
  'consumer-dna-wellness-test': 'DNA test',
  'retreat-wellness-weekend': 'Wellness retreat',
};

function capitalise(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** The short label for a catalog row: an override, or the name before any bracket or slash. */
export function shortName(key: string | null | undefined, fullName: string): string {
  if (key && overrides[key]) return overrides[key];
  const base =
    fullName
      .replace(/\s*\([^)]*\)/g, '')
      .split(' / ')[0]
      ?.trim() ?? '';
  return capitalise(base || fullName);
}

/** What to call one of the person's own items: what they typed, else the short label. */
export function displayName(
  stack: { itemKey: string | null; label?: string; customName?: string },
  fullName?: string,
): string {
  if (stack.label?.trim()) return stack.label.trim();
  if (stack.itemKey && fullName) return shortName(stack.itemKey, fullName);
  return stack.customName ?? fullName ?? '';
}
