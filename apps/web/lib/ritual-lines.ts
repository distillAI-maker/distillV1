import type { RitualPart } from '@distill/engine/ritual';
import { copy } from './copy';

/**
 * How one part of a Ritual reads on a row: a short time column on the left ("6:45", "9:00 / pm",
 * "Mon / Wed / Fri", "3× / a week") and one short line under its name. Shared by the first Ritual
 * and Today, so the two read the same.
 */

type When = RitualPart['when'];
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const DAY_SHORT: Record<string, string> = {
  mon: 'Mon',
  tue: 'Tue',
  wed: 'Wed',
  thu: 'Thu',
  fri: 'Fri',
  sat: 'Sat',
  sun: 'Sun',
};

const often = (n: number) =>
  n === 1 ? [copy.app.ritual.weekly] : [`${n}×`, copy.app.ritual.aWeek];

export interface TimeColumn {
  /** One short line each, top to bottom. */
  readonly lines: readonly string[];
  /** The lines are days, not a clock time: drawn in olive. */
  readonly days: boolean;
}

/**
 * The time column. A clock time first; then the days, when it isn't every day; then how often.
 * `daily` is what an every-day part shows ("Daily" on the first Ritual; blank on Today, where
 * every day is implied).
 */
export function timeColumn(when: When, daily: string = copy.app.ritual.daily): TimeColumn {
  if (when.at) {
    const [h = 0, m = 0] = when.at.split(':').map(Number);
    const time = `${h % 12 || 12}:${String(m).padStart(2, '0')}`;
    return { lines: h >= 12 ? [time, 'pm'] : [time], days: false };
  }
  const days = DAY_ORDER.filter((d) => when.days.includes(d));
  if (days.length && days.length < 7) {
    if (days.length === 5 && !days.includes('sat') && !days.includes('sun'))
      return { lines: [copy.app.ritual.weekdays], days: true };
    if (days.length <= 3) return { lines: days.map((d) => DAY_SHORT[d]!), days: true };
    return { lines: often(days.length), days: true };
  }
  if (!days.length && when.perWeek) return { lines: often(when.perWeek), days: true };
  return { lines: daily ? [daily] : [], days: false };
}

/**
 * The engine's stock reasons, said once per row: most say nothing a mark doesn't say already
 * (Yours, Well-founded), so they give way to it. Anything else (Claude's version, in their words)
 * is shown as written.
 */
const STOCK: Record<string, string | null> = {
  "This one's yours, and it stays exactly as it is.": null,
  'You love this one, so it keeps its place.': copy.app.ritual.loved,
  "One of the well-founded things you do, even on days you can't feel it.": null,
  "Doing real work for your training, even when you can't feel it.": null,
  'Part of your days as they are.': null,
};

/**
 * The line under a part's name: what's special about it ("Yours.", "Well-founded.", "From your
 * clinician."), then its reason when it says something of its own.
 */
export function whyLine(
  part: Pick<RitualPart, 'why' | 'lock'>,
  opts: { founded?: boolean; yours?: boolean } = {},
): string {
  const own = part.why ? (Object.hasOwn(STOCK, part.why) ? STOCK[part.why] : part.why) : null;
  const marks = (
    [
      opts.yours && part.lock === 'theirs' ? copy.app.ritual.yours : null,
      part.lock === 'clinician' ? copy.app.ritual.clinician : null,
      opts.founded ? copy.app.ritual.founded : null,
    ] as (string | null)[]
  ).filter((x): x is string => !!x);
  return [...marks, own].filter(Boolean).join(' ');
}
