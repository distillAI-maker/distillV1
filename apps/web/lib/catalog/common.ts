import { newItemId, type StackItem } from '../progress/types';

/**
 * The things people most often have, as chips to tap: recognising is easier than remembering.
 * Used in onboarding ("Tap everything you do") and in the app, a group at a time ("Anything on your
 * bathroom shelf we haven't seen?"). Keys are routing-table rows; costs are the table's typical
 * monthly cost (checked in common.test.ts). TODO(team): pick these by routing table v4's "how
 * common" column.
 */
export interface CommonItem {
  key: string;
  /** What the chip says: the names people recognise. */
  text: string;
  cost: number;
}

export type CommonGroupId = 'supplements' | 'memberships' | 'habits' | 'apps' | 'body' | 'food';
export type MorePlaceId = 'shelf' | 'bookings' | 'phone' | 'bedside' | 'kitchen';

export const commonGroups: readonly { id: CommonGroupId; items: readonly CommonItem[] }[] = [
  {
    id: 'supplements',
    items: [
      { key: 'magnesium-any-form', text: 'Magnesium', cost: 22 },
      { key: 'creatine-monohydrate', text: 'Creatine', cost: 14 },
      { key: 'protein-powder', text: 'Protein powder', cost: 40 },
      { key: 'vitamin-d3', text: 'Vitamin D', cost: 8 },
      { key: 'omega-3-fish-oil', text: 'Fish oil', cost: 20 },
      { key: 'multivitamin', text: 'Multivitamin', cost: 15 },
      { key: 'greens-powder-ag1-etc', text: 'AG1 or greens', cost: 90 },
      { key: 'electrolytes-lmnt-etc', text: 'LMNT or electrolytes', cost: 45 },
      { key: 'collagen-peptides', text: 'Collagen', cost: 35 },
      { key: 'melatonin', text: 'Melatonin', cost: 10 },
      { key: 'ashwagandha-ksm-66-sensoril', text: 'Ashwagandha', cost: 19 },
      { key: 'probiotic-generic-daily', text: 'Probiotic', cost: 30 },
      { key: 'pre-workout', text: 'Pre-workout', cost: 35 },
      { key: 'sleep-gummies-blend', text: 'Sleep gummies', cost: 20 },
    ],
  },
  {
    id: 'memberships',
    items: [
      { key: 'gym-membership', text: 'Gym', cost: 60 },
      { key: 'premium-gym-membership-equinox-life-time', text: 'Equinox or Life Time', cost: 250 },
      { key: 'boutique-class-membership-barry-s-soulcycle-f45-orangetheory', text: 'Barry\'s, SoulCycle or F45', cost: 200 },
      { key: 'yoga-pilates-studio', text: 'Yoga or Pilates', cost: 150 },
      { key: 'class-pack-or-studio-credits', text: 'ClassPass or credits', cost: 120 },
      { key: 'personal-trainer', text: 'Personal trainer', cost: 300 },
      { key: 'massage-membership-massage-envy-squeeze', text: 'Massage membership', cost: 90 },
      { key: 'sauna-bathhouse-membership', text: 'Sauna or bathhouse', cost: 150 },
      { key: 'recovery-studio-membership-restore-remedy-place-othership', text: 'Recovery studio', cost: 250 },
    ],
  },
  {
    id: 'habits',
    items: [
      { key: '10-000-steps-daily-walk', text: 'Daily walk', cost: 0 },
      { key: 'strength-training', text: 'Strength training', cost: 0 },
      { key: 'morning-sunlight-10-min-outdoors', text: 'Morning sunlight', cost: 0 },
      { key: 'stretching-yoga-before-bed', text: 'Stretching or yoga', cost: 0 },
      { key: 'breathwork-box-4-7-8-physiological-sigh', text: 'Breathwork', cost: 0 },
      { key: 'journaling-worry-list-before-bed', text: 'Journaling', cost: 0 },
      { key: 'reading-paper-before-bed', text: 'Reading before bed', cost: 0 },
      { key: 'cold-shower-morning', text: 'Cold showers', cost: 0 },
    ],
  },
  {
    id: 'apps',
    items: [
      { key: 'meditation-app-calm-headspace', text: 'Calm or Headspace', cost: 15 },
      { key: 'fitness-app-subscription-peloton-app-apple-fitness-ladder', text: 'Peloton or Fitness+', cost: 25 },
      { key: 'nutrition-or-calorie-app-premium', text: 'Calorie or nutrition app', cost: 15 },
      { key: 'continuous-glucose-monitor-no-diabetes', text: 'Glucose monitor', cost: 100 },
      { key: 'blood-panel-subscription-function-etc', text: 'Function or blood tests', cost: 40 },
      { key: 'meal-delivery-or-meal-prep-service', text: 'Meal delivery', cost: 400 },
    ],
  },
  {
    id: 'body',
    items: [
      { key: 'cold-plunge-ice-bath', text: 'Cold plunge', cost: 100 },
      { key: 'sauna-post-workout-or-evening', text: 'Sauna', cost: 0 },
      { key: 'massage-gun', text: 'Massage gun', cost: 10 },
      { key: 'red-light-therapy-panel', text: 'Red light', cost: 30 },
      { key: 'led-face-mask', text: 'LED face mask', cost: 25 },
      { key: 'eight-sleep-cooling-mattress-pad', text: 'Eight Sleep', cost: 50 },
      { key: 'mouth-tape', text: 'Mouth tape', cost: 9 },
      { key: 'weighted-blanket', text: 'Weighted blanket', cost: 15 },
      { key: 'retinol-retinoid-nightly', text: 'Retinol', cost: 40 },
      { key: 'vitamin-c-serum', text: 'Vitamin C serum', cost: 60 },
    ],
  },
  {
    id: 'food',
    items: [
      { key: 'mushroom-coffee', text: 'Mushroom coffee', cost: 35 },
      { key: 'energy-drinks', text: 'Energy drinks', cost: 60 },
      { key: 'kombucha-probiotic-drinks', text: 'Kombucha', cost: 40 },
      { key: 'matcha-green-tea-in-the-afternoon', text: 'Matcha', cost: 0 },
      { key: 'chamomile-tea', text: 'Sleep tea', cost: 8 },
      { key: 'alcohol-in-the-evening', text: 'Evening drinks', cost: 80 },
    ],
  },
];

/**
 * In the app, one place at a time: the less common things that live there, which people forget
 * when they first list what they do.
 */
export const morePlaces: readonly { id: MorePlaceId; items: readonly CommonItem[] }[] = [
  {
    id: 'shelf',
    items: [
      { key: 'zinc-daily', text: 'Zinc', cost: 8 },
      { key: 'vitamin-c-daily', text: 'Vitamin C', cost: 8 },
      { key: 'iron', text: 'Iron', cost: 8 },
      { key: 'vitamin-b12', text: 'B12', cost: 8 },
      { key: 'turmeric-curcumin', text: 'Turmeric', cost: 20 },
      { key: 'l-theanine', text: 'L-theanine', cost: 16 },
      { key: 'glycine', text: 'Glycine', cost: 12 },
      { key: 'lion-s-mane', text: 'Lion\'s mane', cost: 30 },
      { key: 'tart-cherry-juice-extract', text: 'Tart cherry', cost: 30 },
      { key: 'cbd', text: 'CBD', cost: 45 },
      { key: 'biotin', text: 'Biotin', cost: 8 },
      { key: 'psyllium-fibre', text: 'Fibre', cost: 10 },
    ],
  },
  {
    id: 'bookings',
    items: [
      { key: 'second-gym-or-studio-membership', text: 'A second gym or studio', cost: 150 },
      { key: 'massage-monthly', text: 'Monthly massage', cost: 120 },
      { key: 'facials-monthly', text: 'Facials', cost: 150 },
      { key: 'stretch-studio-assisted-stretching', text: 'Stretch studio', cost: 150 },
      { key: 'float-tank', text: 'Float tank', cost: 100 },
      { key: 'cryotherapy-sessions', text: 'Cryotherapy', cost: 200 },
      { key: 'acupuncture', text: 'Acupuncture', cost: 120 },
      { key: 'chiropractor-maintenance-visits', text: 'Chiropractor', cost: 100 },
      { key: 'iv-vitamin-drips', text: 'IV drips', cost: 250 },
      { key: 'retreat-wellness-weekend', text: 'Wellness retreat', cost: 100 },
    ],
  },
  {
    id: 'phone',
    items: [
      { key: 'second-meditation-or-sleep-app', text: 'A second sleep app', cost: 15 },
      { key: 'second-wearable-oura-plus-whoop', text: 'A second wearable', cost: 30 },
      { key: 'consumer-dna-wellness-test', text: 'DNA test', cost: 20 },
      { key: 'hormone-peptide-clinic-trt-glp-1-peptides', text: 'Hormone or peptide clinic', cost: 300 },
      { key: 'sleep-coach-cbt-i', text: 'Sleep coach', cost: 200 },
      { key: 'nutritionist-dietitian', text: 'Nutritionist', cost: 200 },
      { key: 'unlisted-subscription-you-re-still-paying-for', text: 'A subscription you forgot', cost: 0 },
    ],
  },
  {
    id: 'bedside',
    items: [
      { key: 'eye-mask', text: 'Eye mask', cost: 2 },
      { key: 'earplugs', text: 'Earplugs', cost: 2 },
      { key: 'white-noise-sound-machine', text: 'White noise', cost: 5 },
      { key: 'sunrise-alarm-hatch-etc', text: 'Hatch or sunrise alarm', cost: 10 },
      { key: 'blue-light-blocking-glasses', text: 'Blue-light glasses', cost: 5 },
      { key: 'nasal-strips-dilator', text: 'Nasal strips', cost: 10 },
      { key: 'silk-pillowcase', text: 'Silk pillowcase', cost: 3 },
      { key: 'gua-sha-ice-roller', text: 'Gua sha', cost: 1 },
      { key: 'microcurrent-device-nuface', text: 'NuFace', cost: 20 },
      { key: 'compression-boots-normatec', text: 'Normatec', cost: 30 },
      { key: 'sunscreen-daily-spf-30', text: 'Daily sunscreen', cost: 20 },
      { key: 'light-therapy-box-10-000-lux', text: 'Light box', cost: 8 },
    ],
  },
  {
    id: 'kitchen',
    items: [
      { key: 'bone-broth', text: 'Bone broth', cost: 40 },
      { key: 'hydrogen-alkaline-water', text: 'Alkaline water', cost: 40 },
      { key: 'electrolytes-plus-sports-drink', text: 'Sports drinks', cost: 40 },
      { key: 'apple-cider-vinegar', text: 'Apple cider vinegar', cost: 10 },
      { key: 'second-or-third-coffee', text: 'A second coffee', cost: 0 },
      { key: 'fasting-window-skipping-breakfast', text: 'Fasting window', cost: 0 },
      { key: 'water-filter', text: 'Water filter', cost: 10 },
      { key: 'dessert-sugar-before-bed', text: 'Something sweet at night', cost: 0 },
    ],
  },
];

/**
 * A chip, as a row in their stack. A chip that names one thing ("Creatine", "Daily walk") keeps
 * that name as theirs; one that offers a choice ("AG1 or greens") falls back to the short name.
 */
export function commonRow(item: CommonItem, position: number): StackItem {
  const oneName = !/ or |,/.test(item.text);
  return {
    id: newItemId(),
    itemKey: item.key,
    ...(oneName ? { label: item.text } : {}),
    monthlyCost: item.cost,
    answers: {},
    chips: {},
    unknown: [],
    status: 'listed',
    notes: [],
    position,
  };
}
