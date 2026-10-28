import type { RitualPart } from '@distill/engine/ritual';
import { copy } from './copy';

/**
 * The Ritual tab's reading of a day: a part's time, which parts fall on a date, the week's shape,
 * and what changed between two versions of the same day (Later, Lighter, Added, "was 7:30").
 * Pure, so the screen and its tests agree.
 */

type Part = Pick<RitualPart, 'id' | 'when' | 'order' | 'status' | 'minutes' | 'title'> & {
  readonly people?: readonly string[];
};

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
const SLOT_ORDER = { morning: 0, midday: 1, evening: 2, night: 3 } as const;

const noon = (date: string) => new Date(`${date}T12:00:00Z`);
export const weekdayOf = (date: string) => DAYS[noon(date).getUTCDay()]!;
export const weekdayLetter = (date: string) =>
  noon(date).toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
export const weekdayName = (date: string) =>
  noon(date).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
export const dayOfMonth = (date: string) => noon(date).getUTCDate();
/** "Friday, 30 October". */
export const longDate = (date: string) =>
  copy.ritualTab.dayOf(
    weekdayName(date),
    noon(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', timeZone: 'UTC' }),
  );

/** "7:30", "6:30 pm". */
export function clock(at: string): string {
  const [h = 0, m = 0] = at.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')}${h >= 12 ? ' pm' : ''}`;
}

/** The time column: the clock time when there is one, or the part of the day. */
export function timeLabel(part: Pick<RitualPart, 'when'>): string {
  return part.when.at ? clock(part.when.at) : copy.days.slots[part.when.slot];
}

const minutesOf = (p: Pick<RitualPart, 'when'>) =>
  p.when.at ? Number(p.when.at.slice(0, 2)) * 60 + Number(p.when.at.slice(3, 5)) : null;

/** Morning to night: by time of day, then clock time, then the engine's order. */
export function byTime<T extends Pick<RitualPart, 'when' | 'order'>>(parts: readonly T[]): T[] {
  return [...parts].sort(
    (a, b) =>
      SLOT_ORDER[a.when.slot] - SLOT_ORDER[b.when.slot] ||
      (minutesOf(a) ?? 0) - (minutesOf(b) ?? 0) ||
      a.order - b.order,
  );
}

/** The parts of a base week that fall on a date: every day, or that weekday. */
export function partsOn<T extends Part>(parts: readonly T[], date: string): T[] {
  const day = weekdayOf(date);
  return byTime(
    parts.filter(
      (p) => p.status === 'active' && (p.when.days.length ? p.when.days.includes(day) : !p.when.perWeek),
    ),
  );
}

export type Mark = { readonly label: keyof typeof copy.ritualTab.labels; readonly was?: string };

/**
 * What changed on one day between two versions of it: a part that's new is Added, a clock time
 * that moved is Later or Earlier (with the old time), a part that got shorter is Lighter, and one
 * that moved to another part of the day is Moved. Parts that left the day can't be marked in place.
 */
export function changesBetween(before: readonly Part[], after: readonly Part[]): Map<string, Mark> {
  const was = new Map(before.map((p) => [p.id, p]));
  const out = new Map<string, Mark>();
  for (const p of after) {
    const old = was.get(p.id);
    if (!old) {
      out.set(p.id, { label: 'added' });
      continue;
    }
    const a = minutesOf(old);
    const b = minutesOf(p);
    if (a !== null && b !== null && a !== b) {
      out.set(p.id, { label: b > a ? 'later' : 'earlier', was: clock(old.when.at!) });
      continue;
    }
    if (old.minutes && p.minutes && p.minutes < old.minutes) {
      out.set(p.id, { label: 'lighter' });
      continue;
    }
    if (old.when.slot !== p.when.slot || (a === null) !== (b === null)) {
      out.set(p.id, { label: SLOT_ORDER[p.when.slot] > SLOT_ORDER[old.when.slot] ? 'later' : 'moved', ...(a !== null ? { was: clock(old.when.at!) } : {}) });
    }
  }
  return out;
}
