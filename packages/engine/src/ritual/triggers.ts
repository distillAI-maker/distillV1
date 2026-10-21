import { median } from '../experiment/utils.js';
import { partsInMoment } from './ritual.js';
import { addDays, daysBetween } from './time.js';
import type { Moment, PersonModel, RitualPart } from './types.js';

/**
 * Triggers that come from the person's data rather than their words. Both are rules.
 */

export interface NightCheck {
  readonly fire: boolean;
  readonly why:
    | 'off'
    | 'no-night'
    | 'not-enough-history'
    | 'usual'
    | 'too-soon'
    | 'short-night';
  /** How far below their usual, in their own swings (never shown to them). */
  readonly swings?: number;
}

/** Nights needed before "usual" means anything. */
export const NIGHT_HISTORY_MIN = 14;
export const NIGHT_SWINGS = 2;
export const NIGHT_EVERY_DAYS = 3;

/**
 * Last night far below their own usual reshapes this morning, only if they turned on
 * "Let my nights shape my mornings": more than two of their own swings below the median of the
 * 28 nights before it, at most once in three days, and the reply never mentions the measurement.
 */
export function nightTrigger(
  person: PersonModel,
  ctx: { today: string; lastNightReshape?: string },
): NightCheck {
  if (!person.prefs.nightsShapeMornings) return { fire: false, why: 'off' };
  const nights = [...person.signals.lastNights]
    .filter((n) => typeof n.sleepMin === 'number')
    .sort((a, b) => a.date.localeCompare(b.date));
  const last = nights.at(-1);
  // The night that ended this morning (dated by the evening it started, or by the wake date).
  if (!last || (last.date !== ctx.today && last.date !== addDays(ctx.today, -1)))
    return { fire: false, why: 'no-night' };
  const before = nights.filter((n) => n.date < last.date).slice(-28);
  if (before.length < NIGHT_HISTORY_MIN) return { fire: false, why: 'not-enough-history' };
  const values = before.map((n) => n.sleepMin!);
  const mid = median(values);
  const swing = Math.max(1, median(values.map((v) => Math.abs(v - mid))) * 1.4826);
  const swings = (mid - last.sleepMin!) / swing;
  if (swings <= NIGHT_SWINGS) return { fire: false, why: 'usual', swings };
  if (ctx.lastNightReshape && daysBetween(ctx.lastNightReshape, ctx.today) < NIGHT_EVERY_DAYS)
    return { fire: false, why: 'too-soon', swings };
  return { fire: true, why: 'short-night', swings };
}

export interface PartCheck {
  readonly partId: string;
  readonly date: string;
  readonly done: boolean;
}

export interface SlipCheck {
  readonly moment: Moment;
  /** The dates that counted as slipped. */
  readonly dates: readonly string[];
}

/**
 * Most parts of one moment skipped on three of the last four days with records. Only an explicit
 * "skipped" counts: if check-offs are optional, a part nobody ticked may simply be unlogged, and
 * silence is never read as a slip.
 */
export function slipTrigger(
  partsByDate: (date: string) => readonly RitualPart[],
  checks: readonly PartCheck[],
  ctx: { today: string; lastSlip?: Partial<Record<Moment, string>> },
): SlipCheck[] {
  const out: SlipCheck[] = [];
  for (const moment of ['morning', 'night'] as const) {
    const last = ctx.lastSlip?.[moment];
    if (last && daysBetween(last, ctx.today) < 7) continue;
    const slipped: string[] = [];
    let withRecords = 0;
    for (let back = 1; back <= 7 && withRecords < 4; back++) {
      const date = addDays(ctx.today, -back);
      const parts = partsInMoment(partsByDate(date), date, moment);
      if (!parts.length) continue;
      const ids = new Set(parts.map((p) => p.id));
      const records = checks.filter((c) => c.date === date && ids.has(c.partId));
      if (!records.length) continue;
      withRecords++;
      const skipped = records.filter((r) => !r.done).length;
      if (skipped / parts.length > 0.5) slipped.push(date);
    }
    if (withRecords >= 3 && slipped.length >= 3) out.push({ moment, dates: slipped });
  }
  return out;
}
