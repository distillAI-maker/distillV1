import { clockMinutes, dayOf, momentOf, slotOfClock, SLOT_START } from './time.js';
import type { Area, Moment, NewPart, Op, RitualPart, RitualVersion, Slot } from './types.js';

/**
 * How a Ritual is stored and rebuilt.
 *
 * - A base version holds the whole recurring week and is in force from `effectiveFrom`.
 * - The base in force on a date is the newest accepted base whose effectiveFrom is on or before it.
 * - A day version holds edits for one date, applied to whichever base is in force that day. When
 *   the base week changes, an earlier-adjusted day picks the change up; an edit whose part no
 *   longer exists is dropped and reported, never applied to the wrong thing.
 * - Ids are assigned by code and survive every edit, so check-offs and locks follow a part.
 */

export type IdMaker = () => string;

/** The base week in force on a date. */
export function baseOn(versions: readonly RitualVersion[], date: string): RitualVersion | undefined {
  let best: RitualVersion | undefined;
  for (const v of versions) {
    if (v.status !== 'accepted' || v.scope.kind !== 'base') continue;
    if (v.scope.effectiveFrom > date) continue;
    if (!best || v.version > best.version) best = v;
  }
  return best;
}

/** The newest accepted day version for a date, if the day was adjusted. */
export function dayVersionOn(
  versions: readonly RitualVersion[],
  date: string,
): RitualVersion | undefined {
  let best: RitualVersion | undefined;
  for (const v of versions) {
    if (v.status !== 'accepted' || v.scope.kind !== 'day' || v.scope.date !== date) continue;
    if (!best || v.version > best.version) best = v;
  }
  return best;
}

/** Parts of a base week that happen on this date (fixed-day parts only). */
export function partsForDate(parts: readonly RitualPart[], date: string): RitualPart[] {
  const day = dayOf(date);
  return sortParts(parts.filter((p) => p.status === 'active' && p.when.days.includes(day)));
}

/** Parts that happen a few times a week on no fixed day. */
export function flexibleParts(parts: readonly RitualPart[]): RitualPart[] {
  return parts.filter((p) => p.status === 'active' && !p.when.days.length && p.when.perWeek);
}

const startOf = (p: Pick<RitualPart, 'when'>) =>
  p.when.at ? clockMinutes(p.when.at) : SLOT_START[p.when.slot];

export function sortParts(parts: readonly RitualPart[]): RitualPart[] {
  return [...parts].sort((a, b) => startOf(a) - startOf(b) || a.order - b.order || a.id.localeCompare(b.id));
}

function renumber(parts: RitualPart[]): RitualPart[] {
  return sortParts(parts).map((p, i) => ({ ...p, order: i }));
}

/**
 * Engine practices that are rest, not effort, and the name code gives each. Sleeping in never makes
 * a day fuller, so code, not Claude, says what a rest part is: whatever title it was written with,
 * a slow-start part is "Sleep in". A long run can't come in under a rest label.
 */
export const RESTFUL_PRACTICES: ReadonlyMap<string, { readonly title: string; readonly area: Area }> = new Map([
  ['slow-start', { title: 'Sleep in', area: 'sleep' }],
  ['early-night', { title: 'Early night', area: 'sleep' }],
  ['rest-day', { title: 'Rest day', area: 'move' }],
  ['quiet-time', { title: 'Quiet time', area: 'mind' }],
]);

export function partFromNew(
  input: NewPart,
  id: string,
  fallbackDays: readonly RitualPart['when']['days'][number][],
): RitualPart {
  const days = input.days ?? (input.perWeek ? [] : [...fallbackDays]);
  const rest = input.source.kind === 'engine' ? RESTFUL_PRACTICES.get(input.source.rule) : undefined;
  return {
    id,
    when: {
      slot: input.at ? slotOfClock(input.at) : input.slot,
      days,
      ...(input.at ? { at: input.at } : {}),
      ...(input.perWeek ? { perWeek: input.perWeek } : {}),
    },
    order: 0,
    title: rest?.title ?? input.title,
    ...(input.minutes ? { minutes: input.minutes } : {}),
    ...(input.place ? { place: input.place } : {}),
    ...(input.people?.length ? { people: input.people } : {}),
    area: rest?.area ?? input.area,
    why: input.why,
    source: input.source,
    status: 'active',
    lock: null,
  };
}

export interface ApplyResult {
  readonly parts: RitualPart[];
  /** Ops that referred to a part that isn't there (stale after a base change). */
  readonly skipped: readonly Op[];
}

/**
 * Applies edits to a set of parts. For a day, `date` is that day and new parts run only then;
 * for the base week, new parts default to every day unless they say otherwise.
 */
export function applyOps(
  parts: readonly RitualPart[],
  ops: readonly Op[],
  ctx: { scope: 'base' | 'day'; date?: string; newId: IdMaker },
): ApplyResult {
  let out = parts.map((p) => structuredClone(p));
  const skipped: Op[] = [];
  const fallbackDays =
    ctx.scope === 'day' && ctx.date
      ? [dayOf(ctx.date)]
      : (['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const);
  const find = (id: string) => out.find((p) => p.id === id && p.status !== 'removed');
  for (const op of ops) {
    if (op.op === 'add') {
      out.push(partFromNew(op.part, ctx.newId(), fallbackDays));
      continue;
    }
    const part = find(op.partId);
    if (!part) {
      skipped.push(op);
      continue;
    }
    switch (op.op) {
      case 'move': {
        if (op.at) part.when = { ...part.when, at: op.at, slot: op.slot ?? slotOfClock(op.at) };
        else if (op.slot) {
          const { at: _at, ...rest } = part.when;
          void _at;
          part.when = { ...rest, slot: op.slot };
        }
        break;
      }
      case 'shorten':
        part.minutes = Math.min(part.minutes ?? op.minutes, op.minutes);
        break;
      case 'skip':
      case 'remove':
        part.status = 'removed';
        break;
      case 'swap': {
        part.status = 'removed';
        const replacement = partFromNew(op.with, ctx.newId(), part.when.days.length ? part.when.days : fallbackDays);
        out.push(replacement);
        break;
      }
      case 'edit': {
        if (op.title) part.title = op.title;
        if (op.minutes) part.minutes = op.minutes;
        if (op.days) part.when = { ...part.when, days: op.days };
        if (op.perWeek) part.when = { ...part.when, perWeek: op.perWeek };
        if (op.slot) part.when = { ...part.when, slot: op.slot };
        if (op.at === null) {
          const { at: _at, ...rest } = part.when;
          void _at;
          part.when = rest;
        } else if (op.at) part.when = { ...part.when, at: op.at, slot: op.slot ?? slotOfClock(op.at) };
        break;
      }
      case 'lock':
        part.lock = op.lock;
        break;
    }
  }
  out = ctx.scope === 'day' ? out.filter((p) => p.status !== 'removed') : out;
  return { parts: renumber(out), skipped };
}

export interface DayView {
  readonly date: string;
  /** The base week this day is built on. */
  readonly base?: RitualVersion;
  /** The day's edits, when the day was adjusted. */
  readonly day?: RitualVersion;
  readonly parts: readonly RitualPart[];
  /** Edits that no longer apply because the base week changed underneath them. */
  readonly stale: readonly Op[];
}

/** One date's Ritual: the base week in force that day, with the day's own edits on top. */
export function ritualOn(
  versions: readonly RitualVersion[],
  date: string,
  newId: IdMaker = deterministicIds(date),
): DayView {
  const base = baseOn(versions, date);
  const day = dayVersionOn(versions, date);
  const parts = base ? partsForDate(base.parts, date) : [];
  if (!day) return { date, ...(base ? { base } : {}), parts, stale: [] };
  const applied = applyOps(parts, day.ops, { scope: 'day', date, newId });
  return { date, ...(base ? { base } : {}), day, parts: applied.parts, stale: applied.skipped };
}

/**
 * Ids for parts a day version adds, stable for that date, so the same day rebuilt twice gives the
 * same ids (and a check-off made against one rebuild still matches the next).
 */
export function deterministicIds(seed: string): IdMaker {
  let n = 0;
  return () => `${seed}:new:${n++}`;
}

/** Which view a part shows up in, on a given date. */
export function momentOfPart(part: Pick<RitualPart, 'when'>, date: string): Moment {
  return momentOf(dayOf(date), part.when.slot);
}

export function partsInMoment(parts: readonly RitualPart[], date: string, moment: Moment): RitualPart[] {
  return parts.filter((p) => momentOfPart(p, date) === moment);
}

/**
 * Total planned minutes, the measure of how full a day is. Rest counts as nothing only when it is
 * the rest part code named; a rest label on anything else counts its time like any other part.
 */
export function plannedMinutes(parts: readonly RitualPart[]): number {
  return parts.reduce((t, p) => {
    if (p.status === 'removed') return t;
    const rest = p.source.kind === 'engine' ? RESTFUL_PRACTICES.get(p.source.rule) : undefined;
    if (rest && p.title === rest.title) return t;
    return t + (p.minutes ?? 10);
  }, 0);
}

export function slotOf(part: Pick<RitualPart, 'when'>): Slot {
  return part.when.slot;
}
