import postgres from 'postgres';
import { isScreen, screens, type ScreenId } from '../../lib/funnel';

/**
 * The funnel report behind the team page (app/team) and `scripts/funnel.ts`: who reached each
 * screen, where the ones who stopped were when they left, how long each screen takes, and what
 * happened once they were in the app. Read from public.app_events; docs/FUNNEL.md explains it.
 */

export const ranges = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', all: 'All time' } as const;
export type Range = keyof typeof ranges;
export const isRange = (r: unknown): r is Range => typeof r === 'string' && r in ranges;

const rangeMs: Record<Range, number> = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5, all: Infinity };
export function rangeStart(range: Range, now: number): Date {
  return new Date(range === 'all' ? 0 : now - rangeMs[range]);
}

/** One event of a device, oldest first: when, what, the screen, the screen before it, a time, signed in. */
export type Step = [at: number, event: string, s: string | null, prev: string | null, ms: number | null, signedIn: boolean];
export interface Trail {
  device: string;
  source: string | null;
  steps: Step[];
}

let client: postgres.Sql | undefined;
/** The events database, or null where DATABASE_URL isn't set (previews, local without the rig). */
export function funnelSql(): postgres.Sql | null {
  const url = process.env.DATABASE_URL;
  if (!url) return null;
  client ??= postgres(url, { prepare: false, max: 1, idle_timeout: 20 });
  return client;
}

/** People are grouped by the first time this device was counted: everyone who arrived in the range. */
export async function loadTrails(
  sql: postgres.Sql,
  { from, source, limit = 5000 }: { from: Date; source?: string | null; limit?: number },
): Promise<{ trails: Trail[]; capped: boolean }> {
  const rows = await sql<{ device: string; source: string | null; steps: unknown[] }[]>`
    with cohort as (
      select device, min(source) as source, min(at) as first_at
      from public.app_events
      group by device
      having min(at) >= ${from} and (${source ?? null}::text is null or min(source) = ${source ?? null}::text)
      order by min(at) desc
      limit ${limit + 1}
    )
    select c.device, c.source,
      json_agg(json_build_array(
        extract(epoch from e.at) * 1000, e.event, e.props->>'s', e.props->>'prev', e.props->>'ms',
        coalesce(e.props->'in' = 'true'::jsonb, false)
      ) order by e.at) as steps
    from cohort c join public.app_events e using (device)
    group by c.device, c.source, c.first_at
    order by c.first_at desc`;
  const capped = rows.length > limit;
  const trails = rows.slice(0, limit).map((r) => ({
    device: r.device,
    source: r.source,
    steps: (r.steps as unknown[][]).map(toStep),
  }));
  return { trails, capped };
}

function toStep(raw: unknown[]): Step {
  const [at, event, s, prev, ms, signedIn] = raw;
  const n = Number(ms);
  return [
    Number(at),
    String(event),
    typeof s === 'string' ? s : null,
    typeof prev === 'string' ? prev : null,
    ms !== null && Number.isFinite(n) ? n : null,
    signedIn === true,
  ];
}

/** The sources people came in on, for the filter. */
export async function loadSources(sql: postgres.Sql): Promise<string[]> {
  const rows = await sql<{ source: string }[]>`
    select distinct source from public.app_events where source is not null order by source limit 50`;
  return rows.map((r) => r.source);
}

// ---------------------------------------------------------------------------------------------

/** No event for this long and not through onboarding: they stopped, rather than are still going. */
export const IDLE_MS = 30 * 60_000;
/** A share of fewer people than this is noise, so it can't be the steepest drop. */
const STEEP_MIN = 5;
const ZONE = 'America/Los_Angeles';
const dayOf = (at: number) => new Intl.DateTimeFormat('en-CA', { timeZone: ZONE }).format(new Date(at));

const label = (id: string) => screens.find((s) => s.id === id)?.label ?? id;
const onboarding = screens.filter((s) => s.part === 'onboarding');
/** The path everyone walks, in order, ending in the app. Side screens and branches are apart. */
const path = [...onboarding.filter((s) => !('branch' in s && s.branch)).map((s) => s.id as string), 'app'];
const branches = onboarding.filter((s) => 'branch' in s && s.branch).map((s) => s.id as ScreenId);
const appTabs = screens.filter((s) => s.part === 'app').map((s) => s.id as ScreenId);
const isApp = (s: string | null) => !!s && (appTabs as string[]).includes(s);
const isOnboarding = (s: string | null) => !!s && onboarding.some((o) => o.id === s);
const stepIndex = (s: string) => (isApp(s) ? path.length - 1 : path.indexOf(s));

export const tapLabels = {
  made_it_mine: 'Made it mine',
  change_something: 'Change something (back to the study)',
  link_sent: 'Email link sent',
  link_failed: "Email link didn't send",
  link_resent: 'Asked for the link again',
  email_confirmed: 'Opened the email link',
} as const;
export const actionLabels = {
  part_done: 'Ticked off a part',
  message_sent: 'Told Distill something',
  note_written: 'Wrote a note',
  answer_given: 'Answered a card',
  more_done: 'Added more',
  picture_changed: 'Corrected what Distill knows',
  idea_declined: 'Said no to an idea',
  explore_go: 'Answered an Explore card',
} as const;
const milestoneLabels = {
  arrived: 'Opened the app',
  started: 'Gave a name',
  stack_done: 'Finished their stack',
  number_seen: 'Saw their number',
  joined: 'Gave an email',
  home_opened: 'Opened the old home',
} as const;

export interface StepRow {
  id: string;
  label: string;
  /** People who got at least this far. */
  reached: number;
  /** Share of everyone who started. */
  share: number;
  /** People who got this far and no further, and stopped (not still going), and that share of `reached`. */
  stopped: number;
  stoppedShare: number;
  /** Median time spent on this screen before moving on, and how many times that's from. */
  medianMs: number | null;
  timed: number;
}
export interface StopRow {
  id: string;
  label: string;
  people: number;
  share: number;
  /** Median time on that screen before they left, when the page said so. */
  medianMs: number | null;
}
export interface CountRow {
  id: string;
  label: string;
  people: number;
  times?: number;
}
export interface Report {
  /** Everyone who saw an onboarding screen. */
  people: number;
  finished: number;
  stillGoing: number;
  stoppedTotal: number;
  medianFinishMs: number | null;
  path: StepRow[];
  /** The screen most people stop at, and the one that loses the largest share of who reach it. */
  biggestLoss: string | null;
  steepestLoss: string | null;
  branches: CountRow[];
  stopped: StopRow[];
  taps: CountRow[];
  /** Email confirmations counted on any device, since the link often opens in another browser. */
  confirmedAnywhere: number;
  app: {
    people: number;
    signedIn: number;
    demo: number;
    returned: number;
    tabs: CountRow[];
    actions: CountRow[];
  };
  sources: { source: string; people: number; finished: number }[];
  days: { day: string; people: number; finished: number }[];
  milestones: CountRow[];
}

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};
const share = (n: number, of: number) => (of ? n / of : 0);

export function buildReport(trails: readonly Trail[], now: number): Report {
  const reachedAt = new Array<number>(path.length).fill(0);
  const stoppedAt = new Array<number>(path.length).fill(0);
  const timeOn = new Map<string, number[]>();
  const stops = new Map<string, { people: number; ms: number[] }>();
  const branchPeople = new Map<string, number>();
  const tapPeople = new Map<string, number>();
  const tabPeople = new Map<string, number>();
  const actionPeople = new Map<string, { people: number; times: number }>();
  const milestonePeople = new Map<string, number>();
  const bySource = new Map<string, { people: number; finished: number }>();
  const byDay = new Map<string, { people: number; finished: number }>();
  const finishMs: number[] = [];
  let people = 0;
  let finished = 0;
  let stillGoing = 0;
  let confirmedAnywhere = 0;
  const app = { people: 0, signedIn: 0, demo: 0, returned: 0 };

  for (const t of trails) {
    const steps = t.steps;
    if (!steps.length) continue;
    const events = new Set(steps.map((s) => s[1]));
    for (const m of Object.keys(milestoneLabels)) if (events.has(m)) bump(milestonePeople, m);
    if (events.has('email_confirmed')) confirmedAnywhere += 1;

    // The app, for anyone who opened it: onboarding finished here, or an account from another browser.
    const appSteps = steps.filter((s) => s[1] === 'screen' && isApp(s[2]));
    if (appSteps.length) {
      app.people += 1;
      if (steps.some((s) => s[5])) app.signedIn += 1;
      else app.demo += 1;
      if (new Set(steps.map((s) => dayOf(s[0]))).size > 1) app.returned += 1;
      for (const tab of new Set(appSteps.map((s) => s[2]!))) bump(tabPeople, tab);
      const counts = new Map<string, number>();
      for (const s of steps) if (s[1] in actionLabels) counts.set(s[1], (counts.get(s[1]) ?? 0) + 1);
      for (const [a, times] of counts) {
        const row = actionPeople.get(a) ?? { people: 0, times: 0 };
        row.people += 1;
        row.times += times;
        actionPeople.set(a, row);
      }
    }

    // Onboarding: only devices that saw one of its screens are in the funnel.
    const screensSeen = steps.filter((s) => s[1] === 'screen' && s[2] && isScreen(s[2]));
    const first = screensSeen.find((s) => isOnboarding(s[2]));
    if (!first) continue;
    people += 1;
    for (const tap of Object.keys(tapLabels)) if (events.has(tap)) bump(tapPeople, tap);
    for (const b of branches) if (screensSeen.some((s) => s[2] === b)) bump(branchPeople, b);
    for (const s of screensSeen)
      if (s[3] && s[4] !== null && isOnboarding(s[3])) push(timeOn, s[3], s[4]);

    const furthest = Math.max(...screensSeen.map((s) => stepIndex(s[2]!)));
    for (let i = 0; i <= furthest; i++) reachedAt[i] = (reachedAt[i] ?? 0) + 1;
    const done = furthest === path.length - 1;
    const src = bySource.get(t.source ?? 'direct') ?? { people: 0, finished: 0 };
    const day = dayOf(first[0]);
    const daily = byDay.get(day) ?? { people: 0, finished: 0 };
    src.people += 1;
    daily.people += 1;
    if (done) {
      finished += 1;
      src.finished += 1;
      daily.finished += 1;
      const inApp = screensSeen.find((s) => isApp(s[2]));
      if (inApp) finishMs.push(inApp[0] - first[0]);
    }
    bySource.set(t.source ?? 'direct', src);
    byDay.set(day, daily);
    if (done) continue;

    const lastAt = steps[steps.length - 1]![0];
    if (now - lastAt < IDLE_MS) {
      stillGoing += 1;
      continue;
    }
    if (furthest >= 0) stoppedAt[furthest] = (stoppedAt[furthest] ?? 0) + 1;
    // Where they were when they stopped: the last screen shown (after going back, not always the
    // furthest), and how long the page said they stayed on it before leaving.
    const lastShown = screensSeen[screensSeen.length - 1]!;
    const after = steps.filter((s) => s[0] >= lastShown[0] && s[1] === 'left' && s[2] === lastShown[2]);
    const row = stops.get(lastShown[2]!) ?? { people: 0, ms: [] };
    row.people += 1;
    const leftMs = after[after.length - 1]?.[4];
    if (leftMs !== undefined && leftMs !== null) row.ms.push(leftMs);
    stops.set(lastShown[2]!, row);
  }

  const stepRows: StepRow[] = path.map((id, i) => {
    const reached = reachedAt[i]!;
    const stopped = stoppedAt[i]!;
    const times = timeOn.get(id) ?? [];
    return {
      id,
      label: id === 'app' ? 'In the app' : label(id),
      reached,
      share: share(reached, people),
      stopped,
      stoppedShare: share(stopped, reached),
      medianMs: median(times),
      timed: times.length,
    };
  });
  const losing = stepRows.filter((r) => r.stopped > 0);
  const biggestLoss = losing.length ? losing.reduce((a, b) => (b.stopped > a.stopped ? b : a)).id : null;
  const steep = losing.filter((r) => r.reached >= STEEP_MIN);
  const steepestLoss = steep.length ? steep.reduce((a, b) => (b.stoppedShare > a.stoppedShare ? b : a)).id : null;
  const stoppedTotal = [...stops.values()].reduce((n, r) => n + r.people, 0);

  return {
    people,
    finished,
    stillGoing,
    stoppedTotal,
    medianFinishMs: median(finishMs),
    path: stepRows,
    biggestLoss,
    steepestLoss,
    branches: branches.map((id) => ({ id, label: label(id), people: branchPeople.get(id) ?? 0 })),
    stopped: [...stops.entries()]
      .map(([id, r]) => ({ id, label: label(id), people: r.people, share: share(r.people, stoppedTotal), medianMs: median(r.ms) }))
      .sort((a, b) => b.people - a.people || stepIndex(a.id) - stepIndex(b.id)),
    taps: Object.entries(tapLabels).map(([id, l]) => ({ id, label: l, people: tapPeople.get(id) ?? 0 })),
    confirmedAnywhere,
    app: {
      ...app,
      tabs: appTabs.map((id) => ({ id, label: label(id), people: tabPeople.get(id) ?? 0 })),
      actions: Object.entries(actionLabels).map(([id, l]) => ({
        id,
        label: l,
        people: actionPeople.get(id)?.people ?? 0,
        times: actionPeople.get(id)?.times ?? 0,
      })),
    },
    sources: [...bySource.entries()]
      .map(([source, r]) => ({ source, ...r }))
      .sort((a, b) => b.people - a.people),
    days: [...byDay.entries()].map(([day, r]) => ({ day, ...r })).sort((a, b) => a.day.localeCompare(b.day)),
    milestones: Object.entries(milestoneLabels).map(([id, l]) => ({ id, label: l, people: milestonePeople.get(id) ?? 0 })),
  };
}

function bump(m: Map<string, number>, k: string) {
  m.set(k, (m.get(k) ?? 0) + 1);
}
function push(m: Map<string, number[]>, k: string, v: number) {
  const xs = m.get(k);
  if (xs) xs.push(v);
  else m.set(k, [v]);
}

/** "42s", "3m 05s", "1h 02m". */
export function duration(ms: number | null): string {
  if (ms === null) return '–';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}
export const percent = (x: number) => `${Math.round(x * 100)}%`;
