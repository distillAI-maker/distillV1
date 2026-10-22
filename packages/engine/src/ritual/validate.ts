import { quotes } from './person.js';
import { applyOps, partsInMoment, plannedMinutes } from './ritual.js';
import { clockMinutes, dayOf, isWeekend } from './time.js';
import { DAYS, type Moment, type NewPart, type Op, type RitualPart } from './types.js';

/**
 * What a change may never do (docs/ENGINE.md). Every op set from Claude and every composed Ritual
 * passes through here; a failing set is retried once with the errors, then the fallback runs.
 */

/** Practices the engine may add on its own: none of them is something to buy. */
export const ENGINE_RULES = new Set([
  'slow-start',
  'wind-down-anchor',
  'morning-light',
  'easy-movement',
  'walk',
  'stretch',
  'breathing',
  'early-night',
  'rest-day',
  'hard-goal-base',
  'long-session',
  'prep',
  'phone-away',
  'quiet-time',
  'meal-at-home',
  'water',
]);

/** Words that mean "a thing to buy": a part the engine adds must never be one. */
const PRODUCT_WORDS =
  /\b(supplement|capsules?|gummies|gummy|pills?|tablets?|powder|serum|cream|mask|patch|drops?|tincture|shake|bar|subscription|membership|device|tracker|ring|app)\b/i;

export const EARLIEST = 5 * 60;
export const LATEST = 23 * 60 + 30;
export const MAX_PER_MOMENT = 6;
/** Day one stays small: the engine knows least about them then. */
export const DAY_ONE_PER_MOMENT = 3;

export interface Allowed {
  /** Everything they wrote: ideal day, notes, answers, the message this change came from. */
  readonly words: string;
  /** Stack items still in their life (not cleared). */
  readonly stackItemIds: ReadonlySet<string>;
  /** Certified explore ideas. */
  readonly ideaIds: ReadonlySet<string>;
  /** PersonModel.people ids. */
  readonly peopleIds: ReadonlySet<string>;
  /** Names of products in the catalog, so the engine can't slip one in under another name. */
  readonly productNames: readonly string[];
}

export interface Guarded {
  /** Parts made from clinician items, or marked theirs: never touched by the engine. */
  readonly locked: ReadonlySet<string>;
  /** Well-founded things done regularly: never skipped, swapped or removed by the engine. */
  readonly protected: ReadonlySet<string>;
}

function newPartErrors(part: NewPart, allowed: Allowed, where: string): string[] {
  const errors: string[] = [];
  const s = part.source;
  if (s.kind === 'words' && !quotes(allowed.words, s.quote))
    errors.push(`${where}: the quote isn't in their words`);
  if (s.kind === 'stack' && !allowed.stackItemIds.has(s.stackItemId))
    errors.push(`${where}: not something in their life now`);
  if (s.kind === 'explore' && !allowed.ideaIds.has(s.ideaId))
    errors.push(`${where}: not a certified idea`);
  if (s.kind === 'engine' && !ENGINE_RULES.has(s.rule)) errors.push(`${where}: unknown practice`);
  if (s.kind !== 'stack') {
    const title = part.title.toLowerCase();
    if (PRODUCT_WORDS.test(part.title) || allowed.productNames.some((n) => n.length > 3 && title.includes(n)))
      errors.push(`${where}: adds something to buy`);
  }
  for (const id of part.people ?? [])
    if (!allowed.peopleIds.has(id)) errors.push(`${where}: names someone not in their life`);
  if (part.at && (clockMinutes(part.at) < EARLIEST || clockMinutes(part.at) > LATEST))
    errors.push(`${where}: time outside 05:00 to 23:30`);
  return errors;
}

export interface OpsCheck {
  readonly scope: 'base' | 'day';
  /** The parts before: the target day's parts, or the base week. */
  readonly before: readonly RitualPart[];
  readonly ops: readonly Op[];
  readonly actor: 'engine' | 'person';
  readonly guarded: Guarded;
  readonly allowed: Allowed;
  /** For a day: the date, its moments in scope, and whether the day may get fuller. */
  readonly date?: string;
  readonly moments?: readonly Moment[];
  readonly load?: 'lighter' | 'same' | 'heavier';
}

export function validateOps(check: OpsCheck): string[] {
  const errors: string[] = [];
  const byId = new Map(check.before.map((p) => [p.id, p]));
  check.ops.forEach((op, i) => {
    const where = `op ${i + 1} (${op.op})`;
    if (op.op === 'add') {
      errors.push(...newPartErrors(op.part, check.allowed, where));
      return;
    }
    const part = byId.get(op.partId);
    if (!part) {
      errors.push(`${where}: no such part`);
      return;
    }
    if (check.actor === 'engine') {
      if (op.op === 'remove' || op.op === 'edit' || op.op === 'lock')
        errors.push(`${where}: only the person can do this`);
      if (check.guarded.locked.has(part.id) || part.lock) errors.push(`${where}: part is theirs`);
      if (
        check.guarded.protected.has(part.id) &&
        (op.op === 'skip' || op.op === 'swap' || op.op === 'remove')
      )
        errors.push(`${where}: well-founded part stays`);
      if (part.people?.length && (op.op === 'skip' || op.op === 'swap' || op.op === 'remove'))
        errors.push(`${where}: a part with people in it stays`);
      if (check.scope === 'day' && check.moments?.length && check.date) {
        const inScope = check.moments.some((m) => partsInMoment([part], check.date!, m).length);
        if (!inScope) errors.push(`${where}: outside the moments this change touches`);
      }
    } else if (part.lock === 'clinician' && op.op !== 'lock') {
      errors.push(`${where}: between you and your clinician`);
    }
    if (check.scope === 'day' && (op.op === 'remove' || op.op === 'edit' || op.op === 'lock'))
      errors.push(`${where}: a day can only move, shorten, skip, swap or add`);
    if (op.op === 'swap') errors.push(...newPartErrors(op.with, check.allowed, where));
    if ((op.op === 'move' || op.op === 'edit') && op.at && (clockMinutes(op.at) < EARLIEST || clockMinutes(op.at) > LATEST))
      errors.push(`${where}: time outside 05:00 to 23:30`);
  });
  if (errors.length) return errors;
  const after = applyOps(check.before, check.ops, {
    scope: check.scope,
    ...(check.date ? { date: check.date } : {}),
    newId: (() => {
      let n = 0;
      return () => `check-${n++}`;
    })(),
  }).parts.filter((p) => p.status !== 'removed');
  // Locked parts come out exactly as they went in.
  for (const p of check.before)
    if (p.lock || check.guarded.locked.has(p.id)) {
      const same = after.find((a) => a.id === p.id);
      if (!same || JSON.stringify({ ...same, order: 0 }) !== JSON.stringify({ ...p, order: 0 }))
        if (check.actor === 'engine') errors.push(`part "${p.title}" is theirs and changed`);
    }
  if (check.scope === 'day' && check.date) {
    for (const m of ['morning', 'night', 'saturday', 'sunday'] as const)
      if (partsInMoment(after, check.date, m).length > MAX_PER_MOMENT)
        errors.push(`more than ${MAX_PER_MOMENT} parts in the ${m}`);
    if (check.load !== 'heavier' && plannedMinutes(after) > plannedMinutes(check.before))
      errors.push('the day got fuller, and this change asked for lighter or the same');
  } else {
    for (const day of DAYS) {
      const onDay = after.filter((p) => p.when.days.includes(day));
      const moments: Moment[] = isWeekend(day) ? [day === 'sat' ? 'saturday' : 'sunday'] : ['morning', 'night'];
      for (const m of moments) {
        const date = sampleDate(day);
        if (partsInMoment(onDay, date, m).length > MAX_PER_MOMENT)
          errors.push(`more than ${MAX_PER_MOMENT} parts on ${day} ${m}`);
      }
    }
  }
  return errors;
}

/** A fixed date for each weekday, for checks that need one. */
function sampleDate(day: (typeof DAYS)[number]): string {
  const base = '2026-01-05'; // a Monday
  const offset = DAYS.indexOf(day);
  return new Date(+new Date(`${base}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10);
}

/** Active fixed-day parts in each weekday moment ("mon:morning", "sat:saturday"), as the caps count them. */
export function momentCounts(parts: readonly RitualPart[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const day of DAYS) {
    const onDay = parts.filter((p) => p.status === 'active' && p.when.days.includes(day));
    const moments: Moment[] = isWeekend(day) ? [day === 'sat' ? 'saturday' : 'sunday'] : ['morning', 'night'];
    for (const m of moments) out.set(`${day}:${m}`, partsInMoment(onDay, sampleDate(day), m).length);
  }
  return out;
}

/**
 * Whether parts fit a per-moment cap. A moment the rules already filled past the cap (locked
 * parts are never dropped) may stay that full, but nothing may make it fuller.
 */
export function fitsCap(parts: readonly RitualPart[], cap: number, baseline: ReadonlyMap<string, number> = new Map()): boolean {
  for (const [k, n] of momentCounts(parts)) if (n > Math.max(cap, baseline.get(k) ?? 0)) return false;
  return true;
}

export interface RitualCheck {
  readonly parts: readonly RitualPart[];
  readonly allowed: Allowed;
  /** Parts from the previous base that must come through unchanged (theirs, clinician). */
  readonly mustKeep?: readonly RitualPart[];
  readonly perMoment?: number;
  /** Counts from the rules version: moments it filled past perMoment may stay that full. */
  readonly baseline?: ReadonlyMap<string, number>;
}

/** A composed Ritual: sources real, nothing to buy, times sane, moments not overfull. */
export function validateRitual(check: RitualCheck): string[] {
  const errors: string[] = [];
  const cap = check.perMoment ?? MAX_PER_MOMENT;
  check.parts.forEach((p, i) => {
    const where = `part ${i + 1} ("${p.title}")`;
    const asNew: NewPart = {
      title: p.title,
      slot: p.when.slot,
      ...(p.when.at ? { at: p.when.at } : {}),
      ...(p.minutes ? { minutes: p.minutes } : {}),
      ...(p.people ? { people: p.people } : {}),
      area: p.area,
      why: p.why,
      source: p.source,
    };
    errors.push(...newPartErrors(asNew, check.allowed, where));
    if (!p.when.days.length && !p.when.perWeek) errors.push(`${where}: never happens`);
  });
  for (const day of DAYS) {
    const date = sampleDate(day);
    const onDay = check.parts.filter((p) => p.status === 'active' && p.when.days.includes(day));
    const moments: Moment[] = isWeekend(day) ? [day === 'sat' ? 'saturday' : 'sunday'] : ['morning', 'night'];
    for (const m of moments) {
      const limit = Math.max(cap, check.baseline?.get(`${day}:${m}`) ?? 0);
      if (partsInMoment(onDay, date, m).length > limit) errors.push(`more than ${limit} parts on ${day} ${m}`);
    }
  }
  for (const keep of check.mustKeep ?? []) {
    const same = check.parts.find((p) => p.id === keep.id);
    if (!same || JSON.stringify({ ...same, order: 0 }) !== JSON.stringify({ ...keep, order: 0 }))
      errors.push(`part "${keep.title}" is theirs and must stay as it is`);
  }
  return errors;
}

/**
 * The reply has to describe what was done, not something else. It may only name times that are in
 * the new day or in their own message, and only days the change touched or they mentioned.
 */
export function replyErrors(
  reply: string,
  ctx: {
    readonly times: readonly string[];
    readonly dates: readonly string[];
    readonly message?: string;
    readonly today: string;
  },
): string[] {
  const errors: string[] = [];
  const said = (ctx.message ?? '').toLowerCase();
  const timeLike =
    /\b(?:at|by|until|from|around|before|after)\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b|\b(\d{1,2}):(\d{2})\s*(am|pm)?\b|\b(\d{1,2})\s*(am|pm)\b/gi;
  for (const m of reply.matchAll(timeLike)) {
    const raw = m[0];
    const h = Number(m[1] ?? m[4] ?? m[7]);
    const minute = Number(m[2] ?? m[5] ?? 0);
    const meridiem = (m[3] ?? m[6] ?? m[8] ?? '').toLowerCase();
    if (!Number.isFinite(h) || h > 23) continue;
    const candidates = new Set<string>();
    const pad = (x: number) => String(x).padStart(2, '0');
    if (meridiem) candidates.add(`${pad((h % 12) + (meridiem === 'pm' ? 12 : 0))}:${pad(minute)}`);
    else {
      candidates.add(`${pad(h)}:${pad(minute)}`);
      if (h < 12) candidates.add(`${pad(h + 12)}:${pad(minute)}`);
    }
    const ok =
      [...candidates].some((c) => ctx.times.includes(c)) || said.includes(raw.toLowerCase().trim());
    if (!ok) errors.push(`reply names ${raw.trim()}, which isn't in the new day`);
  }
  const touched = new Set(ctx.dates.map(dayOf));
  const names: Record<string, (typeof DAYS)[number]> = {
    monday: 'mon',
    tuesday: 'tue',
    wednesday: 'wed',
    thursday: 'thu',
    friday: 'fri',
    saturday: 'sat',
    sunday: 'sun',
  };
  for (const m of reply.toLowerCase().matchAll(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow)\b/g)) {
    const word = m[1]!;
    if (said.includes(word)) continue;
    if (word === 'tomorrow') {
      const t = new Date(+new Date(`${ctx.today}T00:00:00Z`) + 86400000).toISOString().slice(0, 10);
      if (!ctx.dates.includes(t)) errors.push('reply promises something tomorrow, and nothing changed tomorrow');
      continue;
    }
    if (!touched.has(names[word]!)) errors.push(`reply names ${word}, which this change didn't touch`);
  }
  return errors;
}
