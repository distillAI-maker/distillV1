import type { Condition, Experiment, Night } from '../types';

/**
 * The demo person's first experiment: coffee after 2pm, the Worked Example's first. The fixture
 * is time-shifted so that today is day 14: thirteen mornings are already tapped and the
 * fourteenth is the one on screen, which is how the click-through reaches a verdict. Numbers are
 * example data. The on/off layout is a fixture; Phase 4 owns the real scheduler.
 */

export const demoExperimentId = 'demo-coffee';
export const demoItemKey = 'coffee-after-2pm';

const schedule: Condition[] = ['on', 'on', 'on', 'off', 'off', 'off', 'on', 'on', 'on', 'off', 'off', 'off', 'on', 'off'];

/** Total sleep, minutes, one per night. On-nights run shorter. */
const totalSleep = [392, 401, 388, 447, 438, 452, 396, 383, 405, 441, 455, 436, 390, 444];

/** What the demo person tapped on days 1 to 13. Day 9 had no tap, which stays unknown. */
const taps: Night['tap'][] = ['did', 'did', 'did', 'did', 'didnt', 'did', 'did', 'did', 'unknown', 'did', 'did', 'did', 'did'];

export function isoDaysAgo(days: number, now = new Date()): string {
  const d = new Date(now);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

export function demoExperiment(now = new Date(), monthsIn: number | null | undefined): Experiment {
  const startDate = isoDaysAgo(13, now);
  return {
    id: demoExperimentId,
    itemKey: demoItemKey,
    name: 'Coffee after 2pm',
    status: 'running',
    startDate,
    days: 14,
    schedule,
    observeOnly: false,
    metric: 'Total sleep',
    unit: 'min',
    direction: 'worse',
    prereg: {
      metric: 'Total sleep',
      direction: 'worse',
      alpha: 0.05,
      swing: 40,
      schedule,
      lockedAt: `${startDate}T07:00:00.000Z`,
    },
    instruction: { on: 'Today: coffee as usual.', off: 'Today: no coffee after 2pm.' },
    monthlyCost: 0,
    monthsIn: monthsIn ?? 8,
  };
}

/** The fourteen nights behind the verdict, with the fixture's taps for days 1 to 13. */
export function demoNights(now = new Date()): Night[] {
  return schedule.map((condition, i) => ({
    date: isoDaysAgo(13 - i, now),
    condition,
    value: totalSleep[i] ?? null,
    tap: taps[i] ?? 'unknown',
    counted: true,
  }));
}

/** The numbers the verdict rests on: mean of on-nights minus mean of off-nights. */
export function demoEffect(): { change: number; onMean: number; offMean: number } {
  const on = totalSleep.filter((_, i) => schedule[i] === 'on');
  const off = totalSleep.filter((_, i) => schedule[i] === 'off');
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const onMean = mean(on);
  const offMean = mean(off);
  return { change: Math.round(onMean - offMean), onMean, offMean };
}
