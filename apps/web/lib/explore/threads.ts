/**
 * Explore extends what someone already does; it never adds a new habit. Each thread is one thing in
 * their life, and each avenue is a next step for it in the real world: running leads to a race near
 * them, journaling to a writing workshop. A thread only opens from something they kept, so nothing
 * Distill suggested letting go of ever gets a next step.
 *
 * These are evergreen, and open a live search for their area. Dated events come from
 * lib/ai/engine/explore-feed.ts, only with a page behind them.
 */
export type AvenueKind = 'event' | 'people' | 'deeper' | 'place';
export interface Avenue {
  readonly id: string;
  readonly kind: AvenueKind;
  readonly title: string;
  readonly line: string;
  /** What to search for. {region} and {year} are filled in. */
  readonly query: string;
}
export interface Thread {
  readonly id: string;
  readonly name: string;
  readonly because: string;
  readonly area: 'eat' | 'move' | 'mind' | 'sleep' | 'skin';
  readonly keys: readonly string[];
  /** Words in what they wrote that mean they do this. */
  readonly words?: RegExp;
  readonly avenues: readonly Avenue[];
}

export const THREADS: readonly Thread[] = [
  {
    id: 'running',
    name: 'Running',
    because: 'Because you run',
    area: 'move',
    keys: [],
    words: /\b(running|jogging|marathons?|half[- ]marathon|5k|10k|i run (?:every|most|in|along|at|on|before|after|with|\d)|go for a run|morning run|long run|run club|runs? (?:along|in|by|through|with))\b/i,
    avenues: [
      { id: 'running-race', kind: 'event', title: 'A race to train toward', line: 'A 10K or a half a few months out gives the runs you already do somewhere to go.', query: 'upcoming 10K and half marathon races near {region} {year}' },
      { id: 'running-club', kind: 'people', title: 'A run club near you', line: 'The same miles, with people who notice when you show up.', query: 'run clubs near {region}' },
      { id: 'running-trail', kind: 'place', title: 'A trail you haven’t run', line: 'One morning somewhere new, at the pace you already run.', query: 'best trail runs near {region}' },
    ],
  },
  {
    id: 'strength',
    name: 'Lifting',
    because: 'Because you lift',
    area: 'move',
    keys: ['strength-training', 'gym-membership', 'premium-gym-membership-equinox-life-time', 'personal-trainer', 'creatine-monohydrate', 'protein-powder'],
    words: /\b(lifting|weights|deadlifts?|squats?|powerlifting|crossfit|hyrox)\b/i,
    avenues: [
      { id: 'strength-form', kind: 'deeper', title: 'One coached session on your form', line: 'An hour with someone watching your lifts makes every session after it count for more.', query: 'strength coach technique session near {region}' },
      { id: 'strength-meet', kind: 'event', title: 'A beginner-friendly meet or Hyrox', line: 'Something on the calendar for the strength you’re already building.', query: 'beginner powerlifting meet or Hyrox event near {region} {year}' },
      { id: 'strength-group', kind: 'people', title: 'A group that trains together', line: 'The sets you already do, with people who push you a little.', query: 'group strength training club near {region}' },
    ],
  },
  {
    id: 'classes',
    name: 'Classes',
    because: 'Because you go to classes',
    area: 'move',
    keys: ['boutique-class-membership-barry-s-soulcycle-f45-orangetheory', 'class-pack-or-studio-credits', 'fitness-app-subscription-peloton-app-apple-fitness-ladder'],
    avenues: [
      { id: 'classes-master', kind: 'event', title: 'A masterclass with a visiting teacher', line: 'The class you already love, taught by someone who changes how you do it.', query: 'fitness masterclass or workshop near {region} {year}' },
      { id: 'classes-outdoor', kind: 'event', title: 'A big class outdoors', line: 'Same workout, in a park, with a few hundred other people.', query: 'outdoor fitness class event near {region} {year}' },
    ],
  },
  {
    id: 'yoga',
    name: 'Yoga and Pilates',
    because: 'Because you do yoga or Pilates',
    area: 'move',
    keys: ['yoga-pilates-studio', 'stretching-yoga-before-bed'],
    words: /\b(yoga|pilates|reformer)\b/i,
    avenues: [
      { id: 'yoga-workshop', kind: 'event', title: 'A weekend workshop', line: 'Two hours on the one thing a regular class never has time for.', query: 'yoga or Pilates weekend workshop near {region} {year}' },
      { id: 'yoga-retreat', kind: 'event', title: 'A day retreat', line: 'One whole day of what you already fit around everything else.', query: 'yoga day retreat near {region} {year}' },
      { id: 'yoga-outside', kind: 'place', title: 'Yoga outdoors', line: 'The same practice, with the sky over it.', query: 'outdoor yoga in the park near {region}' },
    ],
  },
  {
    id: 'walking',
    name: 'Walking',
    because: 'Because you walk every day',
    area: 'move',
    keys: ['10-000-steps-daily-walk'],
    avenues: [
      { id: 'walking-long', kind: 'place', title: 'A long walk worth planning', line: 'A whole day on a real trail, built on the walking you already do.', query: 'best long day walks near {region}' },
      { id: 'walking-group', kind: 'people', title: 'A walking group', line: 'Your daily walk, and someone to talk to on it.', query: 'walking groups near {region}' },
      { id: 'walking-event', kind: 'event', title: 'A charity walk', line: 'The steps you take anyway, for something you care about.', query: 'charity walk events near {region} {year}' },
    ],
  },
  {
    id: 'heat-cold',
    name: 'Sauna and cold',
    because: 'Because you like the heat and the cold',
    area: 'mind',
    keys: ['sauna-bathhouse-membership', 'sauna-post-workout-or-evening', 'cold-plunge-ice-bath', 'cold-shower-morning', 'recovery-studio-membership-restore-remedy-place-othership'],
    avenues: [
      { id: 'heat-bathhouse', kind: 'place', title: 'A bathhouse you haven’t tried', line: 'A slow afternoon somewhere built for exactly this.', query: 'best bathhouses and saunas near {region}' },
      { id: 'heat-swim', kind: 'people', title: 'A cold-water swim group', line: 'The cold you already choose, with people in it.', query: 'cold water swimming group near {region}' },
      { id: 'heat-wood', kind: 'place', title: 'A wood-fired sauna by the water', line: 'Worth a drive, and hard to forget.', query: 'wood fired sauna by the water near {region}' },
    ],
  },
  {
    id: 'stillness',
    name: 'Meditation',
    because: 'Because you sit and breathe',
    area: 'mind',
    keys: ['meditation-app-calm-headspace', 'breathwork-box-4-7-8-physiological-sigh'],
    words: /\b(meditat\w+|breathwork)\b/i,
    avenues: [
      { id: 'stillness-day', kind: 'event', title: 'A day-long sit', line: 'What you do for minutes at a time, for one long quiet day.', query: 'one day meditation retreat near {region} {year}' },
      { id: 'stillness-group', kind: 'people', title: 'A weekly group sit', line: 'It’s different in a room with other people.', query: 'weekly meditation group near {region}' },
      { id: 'stillness-weekend', kind: 'event', title: 'A silent weekend', line: 'For when the short sits make you curious about a long one.', query: 'silent meditation weekend retreat near {region} {year}' },
    ],
  },
  {
    id: 'writing',
    name: 'Writing',
    because: 'Because you journal',
    area: 'mind',
    keys: ['journaling-worry-list-before-bed'],
    words: /\b(journal\w*|writing)\b/i,
    avenues: [
      { id: 'writing-workshop', kind: 'event', title: 'A writing workshop', line: 'What you already put on the page, with someone showing you more of what’s there.', query: 'personal writing workshop near {region} {year}' },
      { id: 'writing-group', kind: 'people', title: 'A shut-up-and-write group', line: 'A quiet table of people doing the same thing you do alone.', query: 'shut up and write group near {region}' },
    ],
  },
  {
    id: 'reading',
    name: 'Reading',
    because: 'Because you read',
    area: 'mind',
    keys: ['reading-paper-before-bed'],
    words: /\b(reading|books?)\b/i,
    avenues: [
      { id: 'reading-club', kind: 'people', title: 'A book club worth going to', line: 'The books you’d read anyway, and someone to argue about them with.', query: 'book clubs near {region}' },
      { id: 'reading-talk', kind: 'event', title: 'An author talk', line: 'Hear the person behind a book you’d pick up anyway.', query: 'author talks and book events near {region} {year}' },
      { id: 'reading-shop', kind: 'place', title: 'A bookshop you’ve never been in', line: 'An hour with nothing to do but look.', query: 'best independent bookshops near {region}' },
    ],
  },
  {
    id: 'outdoors',
    name: 'Outdoors',
    because: 'Because you like being outside',
    area: 'mind',
    keys: ['morning-sunlight-10-min-outdoors'],
    words: /\b(hiking|hikes?|outdoors|nature|camping|beach)\b/i,
    avenues: [
      { id: 'outdoors-sunrise', kind: 'place', title: 'A sunrise from somewhere high', line: 'Your morning light, once, from the best seat near you.', query: 'best sunrise hikes near {region}' },
      { id: 'outdoors-stars', kind: 'place', title: 'A night under real stars', line: 'The nearest properly dark sky is usually closer than you think.', query: 'dark sky stargazing spots near {region}' },
      { id: 'outdoors-guided', kind: 'event', title: 'A guided nature walk', line: 'The same outdoors, with someone who knows what you’re looking at.', query: 'guided nature walks near {region} {year}' },
    ],
  },
  {
    id: 'food',
    name: 'Food',
    because: 'Because you care what you eat',
    area: 'eat',
    keys: ['meal-delivery-or-meal-prep-service', 'nutrition-or-calorie-app-premium'],
    words: /\b(cooking|cook dinner|i cook|meal prep|farmers market)\b/i,
    avenues: [
      { id: 'food-class', kind: 'event', title: 'A cooking class', line: 'One evening, and a few meals you’ll make for years.', query: 'hands-on cooking classes near {region} {year}' },
      { id: 'food-market', kind: 'place', title: 'The best farmers market near you', line: 'A slow Saturday, and food from the person who grew it.', query: 'best farmers markets near {region}' },
    ],
  },
  {
    id: 'cup',
    name: 'Tea and coffee',
    because: 'Because you have your cup',
    area: 'eat',
    keys: ['matcha-green-tea-in-the-afternoon', 'coffee-after-2pm', 'chamomile-tea', 'kombucha-probiotic-drinks'],
    avenues: [
      { id: 'cup-tasting', kind: 'event', title: 'A tea or coffee tasting', line: 'You already have the habit. This is how it gets interesting.', query: 'tea or coffee tasting near {region} {year}' },
      { id: 'cup-ferment', kind: 'event', title: 'A fermentation workshop', line: 'Make the thing you keep buying.', query: 'fermentation or kombucha workshop near {region} {year}' },
    ],
  },
  {
    id: 'winding-down',
    name: 'Winding down',
    because: 'Because you protect your sleep',
    area: 'sleep',
    keys: ['eight-sleep-cooling-mattress-pad', 'weighted-blanket'],
    avenues: [
      { id: 'winding-restorative', kind: 'event', title: 'A restorative yoga night', line: 'An evening built around being ready for bed.', query: 'restorative yoga evening class near {region}' },
      { id: 'winding-sound', kind: 'event', title: 'A sound bath', line: 'An hour lying down, on purpose, with other people.', query: 'sound bath near {region} {year}' },
    ],
  },
  {
    id: 'body-work',
    name: 'Looking after your body',
    because: 'Because you look after your body',
    area: 'move',
    keys: ['massage-membership-massage-envy-squeeze', 'massage-gun'],
    avenues: [
      { id: 'body-mobility', kind: 'event', title: 'A mobility workshop', line: 'Learn what the massage is working on, and do some of it yourself.', query: 'mobility workshop near {region} {year}' },
    ],
  },
  {
    id: 'cycling',
    name: 'Cycling',
    because: 'Because you ride',
    area: 'move',
    keys: [],
    words: /\b(cycling|bike rides?|biking|gran fondo)\b/i,
    avenues: [
      { id: 'cycling-ride', kind: 'event', title: 'An organized ride', line: 'A gran fondo or a century: your weekend ride, with a finish line.', query: 'gran fondo or organized bike rides near {region} {year}' },
      { id: 'cycling-club', kind: 'people', title: 'A club ride', line: 'The same road, in a group.', query: 'cycling clubs group rides near {region}' },
    ],
  },
  {
    id: 'swimming',
    name: 'Swimming',
    because: 'Because you swim',
    area: 'move',
    keys: [],
    words: /\b(swimming|i swim|laps|open water)\b/i,
    avenues: [
      { id: 'swimming-open', kind: 'event', title: 'An open-water swim', line: 'Your laps, without the walls.', query: 'open water swim events near {region} {year}' },
      { id: 'swimming-masters', kind: 'people', title: 'A masters swim group', line: 'Someone on deck, and people in the next lane.', query: 'masters swimming group near {region}' },
    ],
  },
  {
    id: 'climbing',
    name: 'Climbing',
    because: 'Because you climb',
    area: 'move',
    keys: [],
    words: /\b(climbing|bouldering)\b/i,
    avenues: [
      { id: 'climbing-outside', kind: 'event', title: 'A first day climbing outside', line: 'With a guide, on real rock, from what you do at the gym.', query: 'guided outdoor climbing day near {region}' },
      { id: 'climbing-comp', kind: 'event', title: 'A friendly comp', line: 'Your gym’s problems, with a crowd.', query: 'beginner bouldering competition near {region} {year}' },
    ],
  },
  {
    id: 'racquets',
    name: 'Racquet sports',
    because: 'Because you play',
    area: 'move',
    keys: [],
    words: /\b(tennis|pickleball|padel|squash)\b/i,
    avenues: [
      { id: 'racquets-ladder', kind: 'people', title: 'A local ladder or league', line: 'A new opponent every week, at your level.', query: 'tennis or pickleball league near {region}' },
      { id: 'racquets-tournament', kind: 'event', title: 'A friendly tournament', line: 'The game you already play, with something on it.', query: 'amateur tennis or pickleball tournament near {region} {year}' },
    ],
  },
  {
    id: 'dance',
    name: 'Dancing',
    because: 'Because you dance',
    area: 'move',
    keys: [],
    words: /\b(dancing|salsa|swing dance)\b/i,
    avenues: [
      { id: 'dance-social', kind: 'event', title: 'A social dance night', line: 'No partner needed, and it’s the same thing you already love.', query: 'social dance nights near {region}' },
    ],
  },
  {
    id: 'together',
    name: 'Your people',
    because: 'Because of who you want more time with',
    area: 'mind',
    keys: [],
    avenues: [
      { id: 'together-class', kind: 'event', title: 'A class for two', line: 'Something to do together that isn’t just dinner.', query: 'fun classes for two near {region} {year}' },
      { id: 'together-weekly', kind: 'people', title: 'A standing weekly thing', line: 'A trivia night or a pickup game: time together that’s already on the calendar.', query: 'weekly social activities near {region}' },
    ],
  },
];

export interface ThreadItem {
  readonly id: string;
  readonly itemKey: string | null;
  readonly status: string;
  readonly customName?: string;
  readonly label?: string;
  readonly dataSource?: boolean;
}

/** What opens a thread: what they kept, in the order that has the most to offer. */
export function threadsFor(input: {
  readonly items: readonly ThreadItem[];
  /** Everything they wrote about their days. */
  readonly words?: string;
  /** Where each thing stands: anything Distill suggested letting go of doesn't get a next step. */
  readonly standings?: Readonly<Record<string, string>>;
  readonly hasPeople?: boolean;
}): readonly (Thread & { readonly from: readonly string[] })[] {
  const kept = input.items.filter((i) => !i.dataSource && i.status !== 'cut' && input.standings?.[i.id] !== 'clear');
  const out: (Thread & { from: string[] })[] = [];
  for (const thread of THREADS) {
    if (thread.id === 'together') continue;
    const from = kept.flatMap((i) => {
      const name = i.label || i.customName || '';
      const tapped = !!i.itemKey && thread.keys.includes(i.itemKey);
      const named = !!thread.words && !!name && thread.words.test(name);
      return tapped || named ? [name || (i.itemKey ?? '')] : [];
    });
    const said = !!thread.words && !!input.words && thread.words.test(input.words);
    if (from.length || said) out.push({ ...thread, from });
  }
  if (input.hasPeople) out.push({ ...THREADS.find((t) => t.id === 'together')!, from: [] });
  return out;
}

/** A live search for this next step in their area. Opens when they tap, never before. */
export function leadUrl(avenue: Avenue, region: string, year: number): string {
  const q = avenue.query.replace('{region}', region.trim()).replace('{year}', String(year));
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}
