import type { RitualPart } from '@distill/engine/ritual';
import { copy } from '../copy';
import type { Progress } from '../progress/types';
import { timeColumn, whyLine, type TimeColumn } from '../ritual-lines';
import { bedClockSaid, people, wakeClockSaid, wakeSaid } from './you';

/**
 * The reveal (step 6), as data: their first Ritual as a card a moment, and what the engine's
 * decisions say in one short line each. Decisions are read as they come: a WORTH_A_LOOK decision
 * (routing table V4, branch routing-table-v4-full) is shown as "worth a look"; until the engine
 * makes those, a kept thing with no evidence that came from nowhere they told us is shown the same way.
 */

/** The parts of a decision the reveal reads. `reason` is a string so newer reasons pass through. */
export interface RevealDecision {
  readonly stackItemId: string | null;
  readonly kind: string;
  readonly reason: string;
  readonly evidenceTier?: string;
  readonly money: number;
  readonly name: string;
}

export interface RevealItem {
  readonly id: string;
  readonly origin?: string;
  readonly status: string;
}

export interface RevealNotes {
  /** Things the engine would clear, with the money a year. */
  readonly letGo: readonly { name: string; yearly: number }[];
  /** Well-founded things they keep, by stack item id. */
  readonly wellFounded: readonly string[];
  /** No independent evidence, and we don't know yet why they have it. */
  readonly worthALook: readonly string[];
}

const WELL_FOUNDED = new Set(['EVIDENCE_REGULAR', 'TRAINS']);
const unique = (xs: string[]) => [...new Set(xs)];

/** A name holding a word Distill never says ("Detox tea") stays off these lines. */
export function sayable(name: string, banned: readonly string[]): boolean {
  return !banned.some((b) =>
    new RegExp(`(?<![\\p{L}])${b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'iu').test(name),
  );
}

export function revealNotes(
  decisions: readonly RevealDecision[],
  items: readonly RevealItem[],
  yours: readonly string[],
  banned: readonly string[] = [],
): RevealNotes {
  const ok = (d: RevealDecision) => sayable(d.name, banned);
  const byItem = new Map<string, RevealDecision[]>();
  for (const d of decisions)
    if (d.stackItemId) byItem.set(d.stackItemId, [...(byItem.get(d.stackItemId) ?? []), d]);
  const letGo = decisions
    .filter((d) => d.kind === 'clear' && ok(d))
    .map((d) => ({ name: d.name, yearly: Math.round(d.money * 12) }));
  const going = new Set(decisions.filter((d) => d.kind === 'clear' || d.kind === 'refer').map((d) => d.stackItemId));
  const flagged = decisions.filter((d) => d.reason === 'WORTH_A_LOOK' && !going.has(d.stackItemId) && ok(d));
  const derived = decisions.filter((d) => {
    if (d.kind !== 'keep' || d.reason !== 'NOTHING_TO_CLEAR' || d.evidenceTier !== 'N' || !d.stackItemId) return false;
    const item = items.find((i) => i.id === d.stackItemId);
    if (!item || item.origin || item.status === 'kept' || item.status === 'protected' || yours.includes(item.id)) return false;
    // Anything else said about it (a clear, an adjustment, a referral) speaks for it instead.
    return (byItem.get(d.stackItemId) ?? []).every((x) => x === d || x.kind === 'keep') && ok(d);
  });
  return {
    letGo: letGo.slice(0, 4),
    wellFounded: unique(
      decisions.filter((d) => d.kind === 'keep' && WELL_FOUNDED.has(d.reason) && d.stackItemId).map((d) => d.stackItemId!),
    ),
    worthALook: unique([...flagged, ...derived].map((d) => d.name)).slice(0, 2),
  };
}

export interface SheetRow {
  readonly id: string;
  readonly title: string;
  readonly time: TimeColumn;
  /** "Yours. Well-founded.", Claude's reason, or empty. */
  readonly why: string;
  readonly yours: boolean;
}

export interface SheetSection {
  readonly key: 'morning' | 'day' | 'night';
  readonly label: string;
  readonly rows: readonly SheetRow[];
}

/** Their first Ritual as the Figma sheet draws it: morning, day and evening, a row a part. */
export function ritualSections(parts: readonly RitualPart[], wellFounded: readonly string[] = []): SheetSection[] {
  const founded = new Set(wellFounded);
  const active = [...parts].filter((p) => p.status === 'active').sort((a, b) => a.order - b.order);
  const groups: [SheetSection['key'], RitualPart[]][] = [
    ['morning', active.filter((p) => p.when.slot === 'morning')],
    ['day', active.filter((p) => p.when.slot === 'midday')],
    ['night', active.filter((p) => p.when.slot === 'evening' || p.when.slot === 'night')],
  ];
  return groups
    .filter(([, ps]) => ps.length)
    .map(([key, ps]) => ({
      key,
      label: copy.app.ritual.sections[key],
      rows: ps.map((p) => {
        const item = p.source.kind === 'stack' ? p.source.stackItemId : null;
        return {
          id: p.id,
          title: p.title,
          time: timeColumn(p.when),
          why: whyLine(p, { yours: true, founded: !!item && founded.has(item) }),
          yours: p.lock === 'theirs',
        };
      }),
    }));
}

const EVERY_DAY = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const minutesOf = (clock: string) => {
  const [h = 0, m = 0] = clock.split(':').map(Number);
  return h * 60 + m;
};
const clockOf = (minutes: number) => {
  const m = ((minutes % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
/** "11:00 pm" for "23:00". */
const bedWords = (clock: string) => {
  const m = minutesOf(clock);
  const h = Math.floor(m / 60);
  return `${h % 12 || 12}:${String(m % 60).padStart(2, '0')} ${h >= 12 ? 'pm' : 'am'}`;
};

export interface RitualDetail {
  /** Their wake-up and bedtime as "HH:MM", when they told us. */
  readonly wake?: string | null;
  readonly bed?: string | null;
  /** What the row's evidence is for ("less muscle soreness after hard exercise"). */
  readonly evidenceFor: (itemKey: string | null) => string | undefined;
  /** Well-founded things they keep, by stack item id. */
  readonly wellFounded: readonly string[];
}

/**
 * The rules draft, said as fully as rules can say it, so a Ritual never reads as a bare list: mornings
 * placed after their wake-up, nights before their bedtime, what each well-founded thing is for, and
 * whose it is. Only their answers and the catalog's own checked line go in; Claude's version replaces
 * all of it when it's on.
 */
export function withDetail(parts: readonly RitualPart[], d: RitualDetail): RitualPart[] {
  const founded = new Set(d.wellFounded);
  const inOrder = [...parts].sort((a, b) => a.order - b.order);
  const free = (slot: RitualPart['when']['slot']) => inOrder.filter((p) => p.status === 'active' && p.when.slot === slot && !p.when.at);
  const clocks = new Map<string, string>();
  if (d.wake) free('morning').forEach((p, i) => clocks.set(p.id, clockOf(minutesOf(d.wake!) + 15 + 15 * Math.floor(i / 2))));
  if (d.bed) free('night').reverse().forEach((p, i) => clocks.set(p.id, clockOf(minutesOf(d.bed!) - 30 - 15 * i)));
  const say = copy.reveal.detail;
  return parts.map((p) => {
    const item = p.source.kind === 'stack' ? p.source : null;
    const benefit = item && founded.has(item.stackItemId) ? d.evidenceFor(item.itemKey) : undefined;
    const why = benefit ? say.founded(benefit) : p.lock === 'theirs' ? say.yours : p.why;
    const at = clocks.get(p.id);
    return { ...p, why, ...(at ? { when: { ...p.when, at } } : {}) };
  });
}

/**
 * The first Ritual's anchors, from their own answers: up at, in bed by, and room for who they want
 * more time with. Claude's version writes its own; these are for the rules version on the reveal.
 */
export function withAnchors(
  parts: readonly RitualPart[],
  a: { readonly wakeLabel?: string | null; readonly wake?: string | null; readonly bed?: string | null; readonly people?: string },
): RitualPart[] {
  const say = copy.reveal.detail;
  const anchor = (id: string, title: string, why: string, when: RitualPart['when'], area: RitualPart['area']): RitualPart => ({
    id: `part:${id}`,
    when,
    order: 0,
    title,
    area,
    why,
    source: { kind: 'engine', rule: id },
    status: 'active',
    lock: null,
  });
  const room = a.people ? say.room[a.people] : undefined;
  const titles = parts.map((p) => p.title.toLowerCase());
  const roomWord = room?.toLowerCase().split(' ').at(-1);
  const inOrder = [...parts].sort((x, y) => x.order - y.order);
  // The day in the order it's lived: up, the day, room for their people, the night, in bed.
  return [
    ...(a.wake && a.wakeLabel ? [anchor('wake', say.up(a.wakeLabel), say.upWhy, { slot: 'morning', days: [...EVERY_DAY], at: a.wake }, 'sleep')] : []),
    ...inOrder.filter((p) => p.when.slot !== 'night'),
    ...(room && roomWord && !titles.some((t) => t.includes(roomWord))
      ? [anchor('room', room, say.roomWhy, { slot: 'evening', days: [], perWeek: 1 }, 'mind')]
      : []),
    ...inOrder.filter((p) => p.when.slot === 'night'),
    ...(a.bed ? [anchor('bed', say.bed(bedWords(a.bed)), say.bedWhy, { slot: 'night', days: [...EVERY_DAY], at: a.bed }, 'sleep')] : []),
  ].map((p, order) => ({ ...p, order }));
}

/**
 * The rules version of a first Ritual, whole: the detail and the anchors, from what they answered.
 * The reveal and the account both use it, so neither ever shows a bare list.
 */
export function wholeRitual(
  parts: readonly RitualPart[],
  progress: Progress,
  decisions: readonly RevealDecision[],
  ctx: { readonly evidenceFor: RitualDetail['evidenceFor']; readonly banned: readonly string[]; readonly anchors?: boolean },
): { parts: RitualPart[]; notes: RevealNotes } {
  const notes = revealNotes(decisions, progress.items, progress.dayOne.yours, ctx.banned);
  const wake = wakeClockSaid(progress);
  const bed = bedClockSaid(progress);
  const detailed = withDetail(parts, { wake, bed, evidenceFor: ctx.evidenceFor, wellFounded: notes.wellFounded });
  if (ctx.anchors === false) return { parts: detailed, notes };
  const who = people(progress);
  return {
    parts: withAnchors(detailed, { wake, wakeLabel: wakeSaid(progress), bed, ...(who ? { people: who } : {}) }),
    notes,
  };
}

/** What they'd never give up from their life that isn't already a part of their Ritual. */
export function alwaysYours(parts: readonly RitualPart[], picks: readonly string[]): string[] {
  const titles = parts.filter((p) => p.status === 'active').map((p) => p.title.toLowerCase());
  return picks.filter((pick) => {
    const words = pick.toLowerCase().match(/[a-z]{4,}/g) ?? [pick.toLowerCase()];
    return !titles.some((t) => words.every((w) => t.includes(w)));
  });
}
