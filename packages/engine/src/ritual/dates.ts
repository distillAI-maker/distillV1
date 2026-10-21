import { z } from 'zod';
import { addDays, datesBetween, dayOf, daysBetween, nextDay } from './time.js';
import { daySchema } from './types.js';

/**
 * Turning "tonight" or "Thursday to Sunday" into calendar dates is where models slip, especially
 * near midnight and across time zones. The message reader returns the phrase and a relative form;
 * this resolves it in code with their time zone and the clock. When the model's own dates disagree,
 * code wins; when code can't read it, the model's dates are used only if they are near.
 */

export const relativeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('today') }).strict(),
  z.object({ kind: z.literal('tonight') }).strict(),
  z.object({ kind: z.literal('tomorrow') }).strict(),
  z.object({ kind: z.literal('weekday'), day: daySchema, which: z.enum(['this', 'next']) }).strict(),
  z.object({ kind: z.literal('weekend'), which: z.enum(['this', 'next']) }).strict(),
  z.object({ kind: z.literal('week'), which: z.enum(['this', 'next']) }).strict(),
  z.object({ kind: z.literal('in-days'), n: z.number().int().min(0).max(60) }).strict(),
  z
    .object({
      kind: z.literal('date'),
      month: z.number().int().min(1).max(12),
      day: z.number().int().min(1).max(31),
    })
    .strict(),
]);
export type Relative = z.infer<typeof relativeSchema>;

export const whenSchema = z
  .object({
    /** Their words: "tonight", "Thursday to Sunday", "from Monday". */
    phrase: z.string().max(120),
    start: relativeSchema,
    end: relativeSchema.optional(),
  })
  .strict();
export type When = z.infer<typeof whenSchema>;

/** Before this many minutes after midnight, "tonight" still means the night that is under way. */
export const NIGHT_ROLLOVER = 5 * 60;

/** The first and last date a relative phrase covers. */
function rangeOf(rel: Relative, today: string, minute: number): { from: string; to: string } | null {
  const one = (d: string) => ({ from: d, to: d });
  switch (rel.kind) {
    case 'today':
      return one(today);
    case 'tonight':
      return one(minute < NIGHT_ROLLOVER ? addDays(today, -1) : today);
    case 'tomorrow':
      return one(addDays(today, 1));
    case 'weekday': {
      const first = nextDay(today, rel.day);
      return one(rel.which === 'next' ? addDays(first, 7) : first);
    }
    case 'weekend': {
      const sat = dayOf(today) === 'sun' ? addDays(today, -1) : nextDay(today, 'sat');
      const start = rel.which === 'next' ? addDays(sat, 7) : sat;
      return { from: start < today ? today : start, to: addDays(start, 1) };
    }
    case 'week': {
      const thisMonday = addDays(today, -(((daysBetween('2026-01-05', today) % 7) + 7) % 7));
      const monday = rel.which === 'next' ? addDays(thisMonday, 7) : thisMonday;
      return { from: rel.which === 'this' ? today : monday, to: addDays(monday, 6) };
    }
    case 'in-days':
      return one(addDays(today, rel.n));
    case 'date': {
      const year = Number(today.slice(0, 4));
      for (const y of [year, year + 1]) {
        const iso = `${y}-${String(rel.month).padStart(2, '0')}-${String(rel.day).padStart(2, '0')}`;
        const valid = new Date(`${iso}T00:00:00Z`).toISOString().slice(0, 10) === iso;
        if (valid && iso >= addDays(today, -1)) return one(iso);
      }
      return null;
    }
  }
}

export interface Resolved {
  readonly dates: readonly string[];
  /** For a plan that starts later ("from Monday"): the first date it applies. */
  readonly startsOn: string;
  readonly source: 'code' | 'model';
  /** The model's own dates didn't match what code read from the same words. */
  readonly disagreed: boolean;
}

/** Dates are kept within a sensible window: yesterday's night to two months ahead. */
const inWindow = (d: string, today: string) => d >= addDays(today, -1) && d <= addDays(today, 60);

export function resolveWhen(
  when: When | null | undefined,
  modelDates: readonly string[],
  ctx: { today: string; minute: number },
): Resolved | null {
  const { today, minute } = ctx;
  const fromModel = modelDates.filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d) && inWindow(d, today));
  if (when) {
    const a = rangeOf(when.start, today, minute);
    const b = when.end ? rangeOf(when.end, today, minute) : a;
    if (a && b && b.to >= a.from) {
      const dates = datesBetween(a.from, b.to)
        .slice(0, 31)
        .filter((d) => inWindow(d, today));
      if (dates.length) {
        const disagreed =
          fromModel.length > 0 && (fromModel[0] !== dates[0] || fromModel.at(-1) !== dates.at(-1));
        return { dates, startsOn: dates[0]!, source: 'code', disagreed };
      }
    }
  }
  if (fromModel.length) return { dates: fromModel, startsOn: fromModel[0]!, source: 'model', disagreed: false };
  return null;
}
