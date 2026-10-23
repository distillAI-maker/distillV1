import { copy } from '../copy';
import type { PictureLine, Progress } from '../progress/types';

/**
 * Steps 4 and 5 of onboarding, as data: who they are at their best and what makes them them, all
 * from taps. Where each answer lives, so the engine reads it (packages/engine/src/ritual/person.ts):
 *   - a recent day that felt like them (who, where, doing what) and what a busy week takes first:
 *     `asks`, one q/a pair each; what a busy week takes is also kept as theirs, so it's protected;
 *   - who they're becoming (and their own line): picture lines of kind "toward", in their words;
 *   - the life things they'd never give up: picture lines of kind "theirs", in their words;
 *   - the stack items they'd never give up: `dayOne.yours`, which makes them theirs and locked;
 *   - and a short ideal-day sentence built from all of it, in `lifeText`, so compose has words.
 */

export const dayQuestions = copy.best.day;
export const busyQuestion = copy.best.busy;
export const becomingOptions = copy.best.becoming;
export const lifeChips = copy.makesYou.lifeChips;
export const MAX_BECOMING = 3;

const TOWARD = 'toward:';
const OWN_TOWARD = 'toward:own';
const THEIRS = 'theirs:';
/** What a busy week takes first: theirs, kept apart from the life things picked on step 5. */
const BUSY = 'theirs:busy';
/** Starts the part of lifeText these steps write; anything before it they typed themselves. */
export const IDEAL_DAY_MARK = 'At my best: ';

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
  const ours = [...lifeChips, ...copy.best.busy.options] as readonly string[];
  return ours.includes(text) ? midSentence(text) : text;
}

/** "a, b and c". */
export function listOf(xs: readonly string[]): string {
  if (xs.length <= 1) return xs[0] ?? '';
  return `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
}

const lines = (p: Progress) => p.picture?.lines ?? [];

function withLines(p: Progress, next: PictureLine[], now: string): Progress {
  return {
    ...p,
    picture: {
      lines: next.slice(0, 40),
      removed: p.picture?.removed ?? [],
      updatedAt: now,
    },
  };
}

// --- step 4: you, at your best ----------------------------------------------------------------

type DayId = (typeof dayQuestions)[number]['id'];

const question = (id: DayId) => dayQuestions.find((d) => d.id === id)!;

/** Their answer about the day, if any. */
export function dayAnswer(p: Progress, id: DayId): string | undefined {
  return p.asks.find((a) => a.q === question(id).q)?.a;
}

/** One tap: picks an option, or clears it when it was already picked. */
export function setDay(p: Progress, id: DayId, label: string, now: string): Progress {
  const q = question(id);
  if (!q.options.some((o) => o.label === label)) return p;
  const same = dayAnswer(p, id) === label;
  const asks = p.asks.filter((a) => a.q !== q.q);
  return withIdealDay({ ...p, asks: same ? asks : [...asks, { q: q.q, a: label, at: now }] });
}

/** What a busy week takes first, if they said. */
export function busyAnswer(p: Progress): string | undefined {
  return p.asks.find((a) => a.q === busyQuestion.q)?.a;
}

/** One tap: the answer, and the same thing kept as theirs so a busy week never takes it. */
export function setBusy(p: Progress, label: string, now: string): Progress {
  if (!(busyQuestion.options as readonly string[]).includes(label)) return p;
  const same = busyAnswer(p) === label;
  const asks = p.asks.filter((a) => a.q !== busyQuestion.q);
  const rest = lines(p).filter((l) => l.id !== BUSY);
  const next = same
    ? { ...p, asks }
    : { ...p, asks: [...asks, { q: busyQuestion.q, a: label, at: now }] };
  const kept = same ? rest : [...rest, { id: BUSY, kind: 'theirs' as const, text: label, by: 'you' as const, at: now }];
  return withIdealDay(withLines(next, kept, now));
}

/** What they protect: what a busy week takes first. */
export function protectedThing(p: Progress): string | null {
  return lines(p).find((l) => l.id === BUSY)?.text ?? null;
}

export function becoming(p: Progress): string[] {
  const chosen = new Set(lines(p).filter((l) => l.kind === 'toward').map((l) => l.id));
  return becomingOptions.filter((b) => chosen.has(`${TOWARD}${slug(b)}`));
}

/** Up to three; a fourth tap does nothing until one comes off. */
export function toggleBecoming(p: Progress, label: string, now: string): Progress {
  if (!(becomingOptions as readonly string[]).includes(label)) return p;
  const id = `${TOWARD}${slug(label)}`;
  const current = lines(p);
  if (current.some((l) => l.id === id)) return withIdealDay(withLines(p, current.filter((l) => l.id !== id), now));
  if (becoming(p).length >= MAX_BECOMING) return p;
  return withIdealDay(withLines(p, [...current, { id, kind: 'toward', text: label, by: 'you', at: now }], now));
}

export function ownWords(p: Progress): string {
  return lines(p).find((l) => l.id === OWN_TOWARD)?.text ?? '';
}

/** Their one line, optional. Kept word for word. */
export function setOwnWords(p: Progress, text: string, now: string): Progress {
  const clean = text.replace(/\s+/g, ' ').slice(0, 200);
  const rest = lines(p).filter((l) => l.id !== OWN_TOWARD);
  const next = clean.trim()
    ? [...rest, { id: OWN_TOWARD, kind: 'toward' as const, text: clean, by: 'you' as const, at: now }]
    : rest;
  return withIdealDay(withLines(p, next, now));
}

// --- step 5: what makes you, you --------------------------------------------------------------

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
  if (current.some((l) => l.id === id)) return withIdealDay(withLines(p, current.filter((l) => l.id !== id), now));
  return withIdealDay(withLines(p, [...current, { id, kind: 'theirs', text: clean, by: 'you', at: now }], now));
}

/** Their own addition: picked as it's added; adding the same thing twice changes nothing. */
export function addOwnThing(p: Progress, text: string, now: string): Progress {
  const clean = text.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!clean || lines(p).some((l) => l.id === `${THEIRS}${slug(clean)}`)) return p;
  return toggleLife(p, clean, now);
}

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

// --- what the engine and the reveal read ------------------------------------------------------

const phrase = (p: Progress, id: DayId, form: 'you' | 'me') =>
  question(id).options.find((o) => o.label === dayAnswer(p, id))?.[form];

const sentence = (bits: readonly (string | undefined)[]) => {
  const s = bits.filter((b): b is string => !!b).join(', ');
  return s ? `${s.charAt(0).toUpperCase()}${s.slice(1)}.` : null;
};

/** Their day, read back to them: "Outside, with friends, moving." Null until they tap. */
export function atBestLine(p: Progress): string | null {
  return sentence([phrase(p, 'where', 'you'), phrase(p, 'who', 'you'), phrase(p, 'doing', 'you')]);
}

const DOING: Record<string, keyof typeof copy.best.read> = {
  Moving: 'moving',
  'Making something': 'making',
  'A long meal': 'meal',
  'Nothing at all': 'nothing',
};
const TOGETHER = new Set(['My partner', 'Friends', 'Family']);

/** What their day says about them, once they've said who and what. */
export function dayRead(p: Progress): string | null {
  const who = dayAnswer(p, 'who');
  const doing = dayAnswer(p, 'doing');
  if (!who || !doing || !DOING[doing]) return null;
  return copy.best.read[DOING[doing]][TOGETHER.has(who) ? 'together' : 'alone'];
}

/** "Becoming stronger and calmer." or null. */
export function becomingLine(p: Progress): string | null {
  const b = becoming(p).map((x) => x.toLowerCase());
  return b.length ? copy.reveal.becoming(listOf(b)) : null;
}

/** The ideal-day sentence the engine reads, built only from what they tapped and wrote here. */
export function idealDayFrom(p: Progress): string {
  const day = sentence([phrase(p, 'where', 'me'), phrase(p, 'who', 'me'), phrase(p, 'doing', 'me')]);
  const out: string[] = [];
  if (day) out.push(`${IDEAL_DAY_MARK}${midSentence(day)}`);
  const busy = busyAnswer(p);
  if (busy) out.push(`When a week gets busy, ${busy.toLowerCase()} goes first.`);
  const b = becomingLine(p);
  if (b) out.push(b);
  const own = ownWords(p).trim();
  if (own) out.push(/[.!?]$/.test(own) ? own : `${own}.`);
  const life = lifePicks(p).map(asSaid);
  if (life.length) out.push(`I'd never give up ${listOf(life)}.`);
  if (!out.length) return '';
  // Without the mark, the first sentence still opens the part these steps write.
  return out[0]!.startsWith(IDEAL_DAY_MARK) ? out.join(' ') : `${IDEAL_DAY_MARK}${midSentence(out.join(' '))}`;
}

/** Rewrites the part of lifeText these steps own; anything they typed before (older saves) stays. */
export function withIdealDay(p: Progress): Progress {
  const at = p.lifeText.indexOf(IDEAL_DAY_MARK);
  const typed = (at >= 0 ? p.lifeText.slice(0, at) : p.lifeText).trim();
  const lifeText = [typed, idealDayFrom(p)].filter(Boolean).join('\n\n').slice(0, 4000);
  return lifeText === p.lifeText ? p : { ...p, lifeText };
}
