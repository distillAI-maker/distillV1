import raw from '../../../../data/explore-bank.json';

/**
 * Real places and regular things near them, each a next step for something they already do: a race
 * club for someone who runs, a sauna for someone who sits in one. These come from the bank of checked
 * ideas (data/explore-bank.json, every page opened on 7 Nov), so Explore has something real to show
 * at once, signed in or not, with no search and no spend. Only the ideas tied to a thread here ever
 * show: Explore extends what they do and never suggests something new.
 */
export interface NearbyIdea {
  readonly id: string;
  readonly thread: string;
  readonly title: string;
  readonly line: string;
  readonly when: string;
  readonly where: string;
  readonly url: string;
}

const BY_THREAD: Readonly<Record<string, readonly string[]>> = {
  running: ['sf-dse-runners-sunday-races', 'nyc-north-brooklyn-runners-bridge-coffee', 'any-parkrun'],
  strength: ['nyc-shape-up-nyc'],
  classes: ['nyc-shape-up-nyc', 'nyc-mark-morris-dance-center'],
  yoga: ['sf-integral-yoga-nidra', 'nyc-integral-yoga-restorative'],
  walking: ['sf-lands-end-trail', 'sf-muir-woods', 'sf-point-reyes-lighthouse', 'nyc-green-wood-cemetery', 'nyc-mount-beacon-hike', 'nyc-rockaway-beach'],
  'heat-cold': ['sf-dolphin-club-swim-and-sauna', 'nyc-russian-turkish-baths'],
  stillness: ['sf-zen-center-evening-zazen', 'sf-green-gulch-sunday-program', 'nyc-village-zendo'],
  reading: ['sf-bird-and-beckett-jazz', 'any-how-to-do-nothing', 'any-meditations-marcus-aurelius', 'any-braiding-sweetgrass'],
  outdoors: ['sf-chabot-free-telescope-nights', 'sf-ano-nuevo-elephant-seals', 'sf-point-reyes-lighthouse', 'nyc-aaa-free-stargazing', 'nyc-jamaica-bay-wildlife-refuge', 'nyc-mount-beacon-hike'],
  food: ['sf-ferry-plaza-farmers-market', 'sf-18-reasons-cooking-class', 'nyc-essex-market', 'nyc-smorgasburg', 'any-maangchi-korean-cooking'],
  'winding-down': ['sf-integral-yoga-nidra', 'nyc-integral-yoga-restorative', 'nyc-trinity-compline-by-candlelight'],
  swimming: ['sf-dolphin-club-swim-and-sauna'],
  climbing: ['sf-dogpatch-boulders'],
  dance: ['sf-lindy-in-the-park', 'sf-ashkenaz-beginner-dance', 'nyc-frim-fram-jam', 'nyc-mark-morris-dance-center'],
  together: ['sf-exploratorium-after-dark', 'sf-18-reasons-cooking-class', 'nyc-bklyn-clay-tryday', 'nyc-queens-night-market'],
};

const SF = /\b(san francisco|sf|bay area|oakland|berkeley|marin|san mateo|palo alto|san jose|peninsula|alameda|emeryville|mill valley|sausalito|daly city|redwood city|mountain view|sunnyvale)\b/i;
const NYC = /\b(new york|nyc|brooklyn|manhattan|queens|bronx|staten island|jersey city|hoboken)\b/i;

/** The bank's city for what they typed, or null when it has nothing local for them. */
export function bankCity(region: string): string | null {
  if (SF.test(region)) return 'San Francisco Bay Area';
  if (NYC.test(region)) return 'New York City';
  return null;
}

type Raw = { id: string; title: string; line: string; when: string; city: string; neighbourhood?: string; url: string };
const IDEAS = new Map((raw as { ideas: Raw[] }).ideas.map((i) => [i.id, i]));

/** For the test: every id above is really in the bank. */
export const threadIdeaIds = () => Object.values(BY_THREAD).flat();
export const bankHas = (id: string) => IDEAS.has(id);

const MAX_PER_THREAD = 3;

/** "Open daily; a parking reservation is required" reads "Open daily". */
function shortWhen(when: string): string {
  const first = when.split(/[;.(]/)[0]!.trim();
  return first.length > 46 ? `${first.slice(0, 44).trimEnd()}…` : first;
}

/** One from each thing they do, then a second from each, so the list is about all of it. */
export function nearbyFor(threads: readonly { readonly id: string }[], region: string, hidden: ReadonlySet<string> = new Set()): NearbyIdea[] {
  const city = bankCity(region);
  const seen = new Set<string>();
  const out: NearbyIdea[] = [];
  for (let round = 0; round < MAX_PER_THREAD; round++) {
    for (const { id: thread } of threads) {
      const next = (BY_THREAD[thread] ?? []).filter((id) => {
        const idea = IDEAS.get(id);
        return idea && (idea.city === 'anywhere' || idea.city === city) && !hidden.has(`idea:${id}`);
      })[round];
      const idea = next ? IDEAS.get(next) : undefined;
      if (!idea || seen.has(idea.id)) continue;
      seen.add(idea.id);
      out.push({
        id: `idea:${idea.id}`,
        thread,
        title: idea.title,
        line: idea.line,
        when: shortWhen(idea.when),
        where: idea.city === 'anywhere' ? '' : (idea.neighbourhood ?? idea.city),
        url: idea.url,
      });
    }
  }
  return out;
}
