import { copy } from '../copy';
import type { PictureLine, Progress } from '../progress/types';

/**
 * The private study (onboarding step 4), as data. Six taps sort their stack into noise and theirs
 * and learn their week; each answer lands where the engine reads it
 * (packages/engine/src/ritual/person.ts and decide.ts):
 *   - which came from a feed: the item's `origin` is "online", so a weak, borrowed thing can be let go;
 *   - what they'd never give up: their items go in `dayOne.yours` (theirs, locked); life things and
 *     their own additions are picture lines of kind "theirs", in their words;
 *   - wake time, what most days are, what they reach for, who they want more time with: `asks`;
 *   - what a busy week takes first: `asks`, and kept as theirs so a reshape never takes it;
 *   - and a short paragraph in their own voice, in `lifeText`, so compose has words to read.
 */

export const study = copy.study;
export const lifeChips = study.yours.lifeChips;

const THEIRS = 'theirs:';
/** What a busy week takes first: theirs, kept apart from the life things they picked. */
const BUSY = 'theirs:busy';
/** Starts the part of lifeText the study writes. Anything before it they typed themselves. */
export const ABOUT_MARK = 'My days: ';
/** What the earlier onboarding wrote there; read so it's replaced, never doubled. */
const OLD_MARKS = ['At my best: '];

const Q = {
  wake: 'What time are you usually up?',
  work: 'What are most days?',
  valve: "When it's a lot, what do you reach for?",
  busy: 'When a week gets busy, what goes first?',
  people: 'Who do you want more time with?',
} as const;
type AskKey = keyof typeof Q;

export const DEFAULT_WAKE = '07:00';
const WAKE_MIN = 5 * 60;
const WAKE_MAX = 9 * 60 + 30;

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'x';

/** "Vitamin D" reads "vitamin D" mid-sentence; "AG1" stays "AG1". */
export function midSentence(s: string): string {
  return /^[A-Z][a-z]/.test(s) ? `${s.charAt(0).toLowerCase()}${s.slice(1)}` : s;
}

/** Our own chips read lower case mid-sentence ("music", "time alone"); what they typed stays as typed. */
export function asSaid(text: string): string {
  const ours = [...lifeChips, ...study.busy.options] as readonly string[];
  return ours.includes(text) ? midSentence(text) : text;
}

/** "a, b and c". */
export function listOf(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

/** "a, b, and c": the read's promise is three separate things. */
function listOfThree(xs: readonly string[]): string {
  if (xs.length <= 2) return xs.join(' and ');
  return `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
}

const lines = (p: Progress) => p.picture?.lines ?? [];

function withLines(p: Progress, next: PictureLine[], now: string): Progress {
  return {
    ...p,
    picture: { lines: next.slice(0, 40), removed: p.picture?.removed ?? [], updatedAt: now },
  };
}

function answer(p: Progress, key: AskKey): string | undefined {
  return p.asks.find((a) => a.q === Q[key])?.a;
}

function setAnswer(p: Progress, key: AskKey, value: string | null, now: string): Progress {
  const asks = p.asks.filter((a) => a.q !== Q[key]);
  return { ...p, asks: value ? [...asks, { q: Q[key], a: value, at: now }] : asks };
}

/** The things on their list the study asks about: what they kept, not the wearable's subscription. */
export function studyItems(p: Progress) {
  return p.items.filter((i) => i.status !== 'cut' && !i.dataSource);
}

// --- 01: which came from a feed ---------------------------------------------------------------

export function fromFeed(p: Progress): string[] {
  return studyItems(p)
    .filter((i) => i.origin === 'online')
    .map((i) => i.id);
}

/** A feed is where it came from. Never for something a clinician gave them. */
export function toggleFeed(p: Progress, itemId: string): Progress {
  const item = p.items.find((i) => i.id === itemId);
  if (!item || item.origin === 'doctor' || item.origin === 'blood test') return p;
  const on = item.origin === 'online';
  return {
    ...p,
    items: p.items.map((i) => {
      if (i.id !== itemId) return i;
      if (!on) return { ...i, origin: 'online' as const };
      const rest = { ...i };
      delete rest.origin;
      return rest;
    }),
    // Something from a feed isn't also something they'd never give up.
    dayOne: on ? p.dayOne : { ...p.dayOne, yours: p.dayOne.yours.filter((y) => y !== itemId) },
  };
}

export function feedLine(p: Progress): string {
  const n = fromFeed(p).length;
  return n ? study.feed.some(n) : study.feed.none;
}

// --- 02: what they'd never give up ------------------------------------------------------------

/** A thing from their list they'd never give up: theirs, and locked in their Ritual. */
export function toggleYours(p: Progress, itemId: string): Progress {
  if (!p.items.some((i) => i.id === itemId)) return p;
  const has = p.dayOne.yours.includes(itemId);
  return {
    ...p,
    dayOne: {
      ...p.dayOne,
      yours: has ? p.dayOne.yours.filter((y) => y !== itemId) : [...p.dayOne.yours, itemId],
    },
  };
}

/** What they'd never give up from their life (not their list), in the order they picked them. */
export function lifePicks(p: Progress): string[] {
  return lines(p)
    .filter((l) => l.kind === 'theirs' && l.id.startsWith(THEIRS) && l.id !== BUSY)
    .map((l) => l.text);
}

export function toggleLife(p: Progress, text: string, now: string): Progress {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!clean) return p;
  const id = `${THEIRS}${slug(clean)}`;
  const current = lines(p);
  if (current.some((l) => l.id === id)) return withAbout(withLines(p, current.filter((l) => l.id !== id), now));
  return withAbout(withLines(p, [...current, { id, kind: 'theirs', text: clean, by: 'you', at: now }], now));
}

/** Their own addition: picked as it's added; adding the same thing twice changes nothing. */
export function addOwnThing(p: Progress, text: string, now: string): Progress {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!clean || lines(p).some((l) => l.id === `${THEIRS}${slug(clean)}`)) return p;
  return toggleLife(p, clean, now);
}

// --- 03: their rhythm -------------------------------------------------------------------------

const toMinutes = (t: string) => {
  const [h = 0, m = 0] = t.split(':').map(Number);
  return h * 60 + m;
};
const toClock = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

/** When they're usually up, as "HH:MM". */
export function wake(p: Progress): string {
  return answer(p, 'wake') ?? DEFAULT_WAKE;
}

/** "6:30" for "06:30". */
export function wakeLabel(p: Progress): string {
  const [h = '0', m = '00'] = wake(p).split(':');
  return `${Number(h)}:${m}`;
}

/** Fifteen minutes earlier or later, between 5:00 and 9:30. */
export function nudgeWake(p: Progress, by: -15 | 15, now: string): Progress {
  const next = Math.min(WAKE_MAX, Math.max(WAKE_MIN, toMinutes(wake(p)) + by));
  return withAbout(setAnswer(p, 'wake', toClock(next), now));
}

/** Saving the time they see, even if they never touched it. */
export function confirmWake(p: Progress, now: string): Progress {
  return answer(p, 'wake') ? p : withAbout(setAnswer(p, 'wake', DEFAULT_WAKE, now));
}

export function work(p: Progress): string | undefined {
  return answer(p, 'work');
}

export function setWork(p: Progress, label: string, now: string): Progress {
  if (!(study.rhythm.work as readonly string[]).includes(label)) return p;
  return withAbout(setAnswer(p, 'work', work(p) === label ? null : label, now));
}

// --- 04: the pressure valve -------------------------------------------------------------------

export function valve(p: Progress): string | undefined {
  return answer(p, 'valve');
}

export function setValve(p: Progress, label: string, now: string): Progress {
  if (!(study.valve.options as readonly string[]).includes(label)) return p;
  return withAbout(setAnswer(p, 'valve', label, now));
}

// --- 05: what a busy week takes first ---------------------------------------------------------

export function busyAnswer(p: Progress): string | undefined {
  return answer(p, 'busy');
}

/** The answer, and the same thing kept as theirs so a busy week never takes it. */
export function setBusy(p: Progress, label: string, now: string): Progress {
  if (!(study.busy.options as readonly string[]).includes(label)) return p;
  const next = setAnswer(p, 'busy', label, now);
  const kept = [
    ...lines(next).filter((l) => l.id !== BUSY),
    { id: BUSY, kind: 'theirs' as const, text: label, by: 'you' as const, at: now },
  ];
  return withAbout(withLines(next, kept, now));
}

/** What they protect: what a busy week takes first. */
export function protectedThing(p: Progress): string | null {
  return lines(p).find((l) => l.id === BUSY)?.text ?? null;
}

// --- 06: who they want more time with ---------------------------------------------------------

export function people(p: Progress): string | undefined {
  return answer(p, 'people');
}

export function setPeople(p: Progress, label: string, now: string): Progress {
  if (!(study.people.options as readonly string[]).includes(label)) return p;
  return withAbout(setAnswer(p, 'people', label, now));
}

// --- the read ---------------------------------------------------------------------------------

type Keyed<T> = Partial<Record<string, T>>;
const pick = <T,>(map: Keyed<T>, key: string | undefined) => (key ? map[key] : undefined);

/**
 * What we heard, read back: the headline (with its italic part), the context under it, and the
 * promise. Each clause comes from one answer; a skipped question just leaves its clause out.
 */
export function readOf(p: Progress): { title: readonly [string, string]; context: string | null; promise: string | null } {
  const r = study.read;
  const title = (pick(r.valve as Keyed<readonly [string, string]>, valve(p)) ?? r.fallback) as readonly [string, string];
  const busy = busyAnswer(p);
  const day = [
    answer(p, 'wake') ? r.up(wakeLabel(p)) : null,
    pick(r.work as Keyed<string>, work(p)) ?? null,
  ].filter((x): x is string => !!x);
  const sentences = [
    day.length ? `${day.join(', ').replace(/^./, (c) => c.toUpperCase())}.` : null,
    busy ? `${r.goesFirst(busy.toLowerCase()).replace(/^./, (c) => c.toUpperCase())}.` : null,
  ].filter((x): x is string => !!x);
  const context = sentences.length ? sentences.join(' ') : null;
  const promise = [
    pick(r.mornings as Keyed<string>, work(p)),
    pick(r.protect as Keyed<string>, busy),
    pick(r.room as Keyed<string>, people(p)),
  ].filter((x): x is string => !!x);
  return { title, context, promise: promise.length ? r.so(listOfThree(promise)) : null };
}

// --- what the engine reads --------------------------------------------------------------------

/** A short paragraph in their own voice, built only from what they tapped. */
export function aboutFrom(p: Progress): string {
  const out: string[] = [];
  const mine = study.mine;
  const day = [answer(p, 'wake') ? `up at ${wakeLabel(p)}` : null, pick(mine.work as Keyed<string>, work(p))].filter(Boolean);
  if (day.length) out.push(`${ABOUT_MARK}${day.join(', ')}.`);
  const v = pick(mine.valve as Keyed<string>, valve(p));
  if (v) out.push(v);
  const busy = busyAnswer(p);
  if (busy) out.push(`When a week gets busy, ${busy.toLowerCase()} goes first.`);
  const who = pick(mine.people as Keyed<string>, people(p));
  if (who) out.push(`I want more time with ${who}.`);
  const life = lifePicks(p).map(asSaid);
  if (life.length) out.push(`I'd never give up ${listOf(life)}.`);
  if (!out.length) return '';
  return out[0]!.startsWith(ABOUT_MARK) ? out.join(' ') : `${ABOUT_MARK}${out.join(' ')}`;
}

/** Rewrites the part of lifeText the study owns; anything they typed before (older saves) stays. */
export function withAbout(p: Progress): Progress {
  const marks = [ABOUT_MARK, ...OLD_MARKS];
  const at = Math.min(...marks.map((m) => p.lifeText.indexOf(m)).filter((i) => i >= 0), p.lifeText.length);
  const typed = p.lifeText.slice(0, at).trim();
  const lifeText = [typed, aboutFrom(p)].filter(Boolean).join('\n\n').slice(0, 4000);
  return lifeText === p.lifeText ? p : { ...p, lifeText };
}

/** Where the study opens: the first question not yet answered, or the read when all are. */
export function firstOpen(p: Progress): number {
  if (!p.asks.some((a) => a.q === Q.wake)) {
    // 01 and 02 have no single answer to check; someone new starts at the top.
    return 0;
  }
  if (!valve(p)) return 3;
  if (!busyAnswer(p)) return 4;
  if (!people(p)) return 5;
  return 6;
}
