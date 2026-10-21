import { baseOn, partsInMoment, ritualOn } from './ritual.js';
import { addDays, dayOf } from './time.js';
import type { Moment, RitualPart, RitualVersion } from './types.js';

/**
 * Which days and parts a change touches, and which of those parts the engine may move. Rules only.
 */

export interface ScopeTarget {
  readonly date: string;
  readonly moments: readonly Moment[];
  readonly parts: readonly RitualPart[];
}

export interface Scope {
  readonly kind: 'day' | 'base';
  readonly targets: readonly ScopeTarget[];
  /** For a base change: the date it starts. */
  readonly effectiveFrom?: string;
  readonly movable: readonly string[];
  /** Theirs or from a clinician: never moved, shortened, swapped or reworded. */
  readonly locked: readonly string[];
  /** Well-founded and regular: never skipped or swapped to make a day lighter. */
  readonly protected: readonly string[];
  /** Parts with people in them: never removed by the engine. */
  readonly withPeople: readonly string[];
}

export interface ScopeInput {
  readonly kind: 'message' | 'plan' | 'night' | 'slip';
  readonly dates: readonly string[];
  readonly moments: readonly Moment[];
  readonly durability: 'once' | 'ongoing';
  readonly load: 'lighter' | 'same' | 'heavier';
  readonly today: string;
  readonly versions: readonly RitualVersion[];
  readonly theirsItemIds: readonly string[];
  readonly clinicianItemIds: readonly string[];
  readonly protectedItemIds: readonly string[];
}

const ALL: readonly Moment[] = ['morning', 'night', 'saturday', 'sunday'];

/** The view that holds a date's morning: the weekday morning, or the whole weekend day. */
export function morningOf(date: string): Moment {
  const day = dayOf(date);
  return day === 'sat' ? 'saturday' : day === 'sun' ? 'sunday' : 'morning';
}

function momentsOn(date: string, wanted: readonly Moment[]): Moment[] {
  const day = dayOf(date);
  const weekend: Moment | null = day === 'sat' ? 'saturday' : day === 'sun' ? 'sunday' : null;
  const asked = wanted.length ? wanted : ALL;
  const out = new Set<Moment>();
  for (const m of asked) {
    if (m === 'saturday' || m === 'sunday') {
      if (m === weekend) out.add(m);
    } else if (weekend) out.add(weekend);
    else out.add(m);
  }
  return [...out];
}

export function scopeTrigger(input: ScopeInput): Scope {
  const classify = (parts: readonly RitualPart[]) => {
    const locked: string[] = [];
    const prot: string[] = [];
    const people: string[] = [];
    const movable: string[] = [];
    for (const p of parts) {
      const item = p.source.kind === 'stack' ? p.source.stackItemId : null;
      const isLocked =
        !!p.lock ||
        (item !== null && (input.theirsItemIds.includes(item) || input.clinicianItemIds.includes(item)));
      if (isLocked) locked.push(p.id);
      else movable.push(p.id);
      if (item !== null && input.protectedItemIds.includes(item)) prot.push(p.id);
      if (p.people?.length) people.push(p.id);
    }
    return { locked, prot, people, movable };
  };

  if (input.durability === 'ongoing' || input.kind === 'slip') {
    const effectiveFrom = input.dates[0] && input.dates[0] > input.today ? input.dates[0] : input.today;
    const base = baseOn(input.versions, effectiveFrom);
    const parts = base?.parts.filter((p) => p.status === 'active') ?? [];
    const c = classify(parts);
    return {
      kind: 'base',
      targets: [{ date: effectiveFrom, moments: input.moments.length ? input.moments : ALL, parts }],
      effectiveFrom,
      movable: c.movable,
      locked: c.locked,
      protected: c.prot,
      withPeople: c.people,
    };
  }

  let pairs: { date: string; moments: Moment[] }[];
  if (input.kind === 'night') {
    // A short night shapes the morning after it, which is today.
    pairs = [{ date: input.today, moments: [morningOf(input.today)] }];
  } else {
    const dates = input.dates.length ? input.dates : [input.today];
    const onlyTonight =
      input.moments.length > 0 &&
      input.moments.every((m) => m === 'night') &&
      dates.length === 1 &&
      input.load === 'lighter';
    pairs = onlyTonight
      ? // A late night is felt the next morning: that's the part of the Ritual that changes.
        [{ date: addDays(dates[0]!, 1), moments: [morningOf(addDays(dates[0]!, 1))] }]
      : dates.map((date) => ({ date, moments: momentsOn(date, input.moments) }));
  }
  const targets: ScopeTarget[] = pairs.map(({ date, moments }) => {
    const day = ritualOn(input.versions, date);
    const parts = moments.flatMap((m) => partsInMoment(day.parts, date, m));
    return { date, moments, parts: [...new Map(parts.map((p) => [p.id, p])).values()] };
  });
  const c = classify(targets.flatMap((t) => t.parts));
  const uniq = (xs: string[]) => [...new Set(xs)];
  return {
    kind: 'day',
    targets,
    movable: uniq(c.movable),
    locked: uniq(c.locked),
    protected: uniq(c.prot),
    withPeople: uniq(c.people),
  };
}
