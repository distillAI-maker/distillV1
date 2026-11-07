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
  bed: 'What time are you usually in bed?',
  work: 'What are most days?',
  valve: "When it's a lot, what do you reach for?",
  busy: 'When a week gets busy, what goes first?',
  people: 'Who do you want more time with?',
} as const;
type AskKey = keyof typeof Q;

export const DEFAULT_WAKE = '07:00';
export const DEFAULT_BED = '23:00';
const DAY_MINUTES = 24 * 60;

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
function wakeLabelOf(time: string): string {
  const [h = '0', m = '00'] = time.split(':');
  return `${Number(h)}:${m}`;
}
export function wakeLabel(p: Progress): string {
  return wakeLabelOf(wake(p));
}

/** Their wake-up time as they told us ("6:30"), or nothing if they never said. */
export function wakeSaid(p: Progress): string | null {
  return answer(p, 'wake') ? wakeLabel(p) : null;
}

/** Their wake-up and bedtime as "HH:MM", or nothing if they never said. */
export function wakeClockSaid(p: Progress): string | null {
  return answer(p, 'wake') ?? null;
}
export function bedClockSaid(p: Progress): string | null {
  return answer(p, 'bed') ?? null;
}

/** Fifteen minutes earlier or later, round the whole 24-hour clock (23:45 comes before 00:00). */
const nudged = (time: string, by: -15 | 15) => toClock((((toMinutes(time) + by) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES);

export function nudgeWake(p: Progress, by: -15 | 15, now: string): Progress {
  return withAbout(setAnswer(p, 'wake', nudged(wake(p), by), now));
}

/** Saving the time they see, even if they never touched it. */
export function confirmWake(p: Progress, now: string): Progress {
  const woke = answer(p, 'wake') ? p : setAnswer(p, 'wake', DEFAULT_WAKE, now);
  const slept = answer(woke, 'bed') ? woke : setAnswer(woke, 'bed', DEFAULT_BED, now);
  return slept === p ? p : withAbout(slept);
}

/** When they're usually in bed, as "HH:MM". */
export function bed(p: Progress): string {
  return answer(p, 'bed') ?? DEFAULT_BED;
}

/** "23:00", "00:30": the 24-hour clock, as the time pickers show it. */
export function bedLabel(p: Progress): string {
  return bed(p);
}

export function nudgeBed(p: Progress, by: -15 | 15, now: string): Progress {
  return withAbout(setAnswer(p, 'bed', nudged(bed(p), by), now));
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

/** What their Ritual is being shaped around, from their answers: "Short weekday mornings". */
export function shapingLines(p: Progress): string[] {
  const r = study.read;
  return [pick(r.mornings as Keyed<string>, work(p)), pick(r.protect as Keyed<string>, busyAnswer(p)), pick(r.room as Keyed<string>, people(p))]
    .filter((x): x is string => !!x)
    .map((x) => x.replace(/^./, (c) => c.toUpperCase()));
}

// --- what Distill knows ------------------------------------------------------------------------

/** One line of the long view in Your things. */
export interface KnownLine {
  readonly id: string;
  readonly group: 'now' | 'days' | 'people' | 'toward' | 'you';
  readonly text: string;
  readonly since?: string;
  readonly until?: string;
}

const noStop = (s: string) => s.replace(/[.!]+$/, '');
const YOUR_PEOPLE: Readonly<Record<string, string>> = {
  Partner: 'your partner',
  Friends: 'your friends',
  Family: 'your family',
  Myself: 'yourself',
  'New people': 'new people',
};

/** "11:00 pm" for "23:00". */
function clockWords(time: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
}

/**
 * What their answers say about them, written back in plain sentences. It's the part of "What Distill
 * knows" that needs no model, so it's there from the first moment, signed in or not.
 */
export function knownFromAnswers(p: Progress, nameOf: (itemId: string) => string): KnownLine[] {
  const r = study.read;
  const out: KnownLine[] = [];
  const up = answer(p, 'wake');
  const down = answer(p, 'bed');
  if (up && down) out.push({ id: 'answer:day', group: 'days', text: `You're usually up at ${clockWords(up)} and in bed by ${clockWords(down)}` });
  else if (up) out.push({ id: 'answer:day', group: 'days', text: `You're usually up at ${clockWords(up)}` });
  else if (down) out.push({ id: 'answer:day', group: 'days', text: `You're usually in bed by ${clockWords(down)}` });
  const job = pick(r.work as Keyed<string>, work(p));
  if (job) out.push({ id: 'answer:work', group: 'days', text: `Most days you're ${job}` });
  const busy = busyAnswer(p);
  if (busy) out.push({ id: 'answer:busy', group: 'days', text: `When a week gets busy, ${busy.toLowerCase()} goes first` });
  const who = people(p);
  if (who && YOUR_PEOPLE[who]) out.push({ id: 'answer:people', group: 'people', text: `You want more time with ${YOUR_PEOPLE[who]}` });
  const reach = pick(r.valve as Keyed<readonly [string, string]>, valve(p));
  if (reach) out.push({ id: 'answer:valve', group: 'you', text: noStop(reach.join('')) });
  const life = lifePicks(p).map(asSaid);
  if (life.length) out.push({ id: 'answer:life', group: 'you', text: `You'd never give up ${listOf(life)}` });
  const live = new Set(studyItems(p).map((i) => i.id));
  const mine = p.dayOne.yours.filter((id) => live.has(id)).map(nameOf).filter(Boolean);
  if (mine.length) out.push({ id: 'answer:yours', group: 'you', text: `${listOf(mine)} ${mine.length === 1 ? 'is' : 'are'} yours, always` });
  const feed = fromFeed(p).map(nameOf).filter(Boolean);
  if (feed.length) out.push({ id: 'answer:feed', group: 'you', text: `${listOf(feed)} came from social media` });
  return out;
}

/** They said a line isn't right: the answer behind it goes, and lifeText is written again without it. */
export function forgetAnswer(p: Progress, id: string, now: string): Progress {
  const clear = (...keys: AskKey[]) => keys.reduce((next, key) => setAnswer(next, key, null, now), p);
  switch (id) {
    case 'answer:day':
      return withAbout(clear('wake', 'bed'));
    case 'answer:work':
      return withAbout(clear('work'));
    case 'answer:valve':
      return withAbout(clear('valve'));
    case 'answer:people':
      return withAbout(clear('people'));
    case 'answer:busy':
      return withAbout(withLines(clear('busy'), lines(p).filter((l) => l.id !== BUSY), now));
    case 'answer:life':
      return withAbout(withLines(p, lines(p).filter((l) => l.kind !== 'theirs' || l.id === BUSY), now));
    case 'answer:yours':
      return { ...p, dayOne: { ...p.dayOne, yours: [] } };
    case 'answer:feed':
      return { ...p, items: p.items.map((i) => (i.origin === 'online' ? { ...i, origin: undefined } : i)) };
    default:
      return p;
  }
}

// --- what the engine reads --------------------------------------------------------------------

/** A short paragraph in their own voice, built only from what they tapped. */
export function aboutFrom(p: Progress): string {
  const out: string[] = [];
  const mine = study.mine;
  const day = [
    answer(p, 'wake') ? `up at ${wakeLabel(p)}` : null,
    answer(p, 'bed') ? `in bed by ${clockWords(bed(p))}` : null,
    pick(mine.work as Keyed<string>, work(p)),
  ].filter(Boolean);
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
