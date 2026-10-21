import { addDays, localDateTime, weekday } from '../experiment/utils.js';
import { DAYS, type Day, type Moment, type Slot } from './types.js';

export { addDays };

/** The person's own calendar date for an instant. */
export function localDate(instant: string, timeZone: string): string {
  return localDateTime(instant, timeZone).date;
}

/** Minutes since local midnight for an instant. */
export function localMinute(instant: string, timeZone: string): number {
  return localDateTime(instant, timeZone).minute;
}

/** 'mon' to 'sun' for a YYYY-MM-DD date. */
export function dayOf(date: string): Day {
  // weekday(): 0 is Sunday.
  return (['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const)[weekday(date)]!;
}

export const isWeekend = (day: Day) => day === 'sat' || day === 'sun';

/** Which view a part on this weekday, at this time of day, shows up in. */
export function momentOf(day: Day, slot: Slot): Moment {
  if (day === 'sat') return 'saturday';
  if (day === 'sun') return 'sunday';
  return slot === 'morning' || slot === 'midday' ? 'morning' : 'night';
}

/** The times of day a moment covers on a given date. */
export function slotsFor(moment: Moment, date: string): readonly Slot[] {
  const day = dayOf(date);
  if (moment === 'saturday' || moment === 'sunday')
    return (moment === 'saturday') === (day === 'sat') && isWeekend(day)
      ? ['morning', 'midday', 'evening', 'night']
      : [];
  if (isWeekend(day))
    return moment === 'morning' ? ['morning', 'midday'] : ['evening', 'night'];
  return moment === 'morning' ? ['morning', 'midday'] : ['evening', 'night'];
}

/** "07:30" to minutes. */
export function clockMinutes(clock: string): number {
  const [h, m] = clock.split(':').map(Number);
  return h! * 60 + m!;
}

/** Minutes to "07:30". */
export function minutesClock(minutes: number): string {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Typical start of each time of day, used only to order parts that have no time. */
export const SLOT_START: Record<Slot, number> = {
  morning: 6 * 60,
  midday: 11 * 60 + 30,
  evening: 17 * 60,
  night: 21 * 60,
};

/** The slot a clock time belongs to. */
export function slotOfClock(clock: string): Slot {
  const m = clockMinutes(clock);
  if (m < 11 * 60) return 'morning';
  if (m < 16 * 60) return 'midday';
  if (m < 20 * 60) return 'evening';
  return 'night';
}

/** Every date from `from` to `to`, inclusive. */
export function datesBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/** The next date on or after `from` that falls on `day`. */
export function nextDay(from: string, day: Day): string {
  const target = DAYS.indexOf(day);
  const current = DAYS.indexOf(dayOf(from));
  return addDays(from, (target - current + 7) % 7);
}

/** Whole days from a to b (b minus a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((+new Date(`${b}T00:00:00Z`) - +new Date(`${a}T00:00:00Z`)) / 86400000);
}
