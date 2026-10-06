import { createSchedule, enumerateAssignments } from '../experiment/schedule.js';
import type { Schedule } from '../experiment/types.js';
import { immutable, sameJson } from '../experiment/utils.js';
import { mean } from './math.js';

export interface RandomizationPoint {
  readonly block: number;
  /** Real measurement, or log HRV; the same transform is used under every assignment. */
  readonly value: number;
}
export interface RandomizationResult {
  readonly method: 'exact_scheduled_block_randomization';
  readonly nullHypothesis: 'sharp_no_effect';
  readonly statistic: number;
  readonly assignmentCount: number;
  readonly minimumOneSidedP: number;
  readonly beneficialExtreme: number;
  readonly oppositeExtreme: number;
  readonly beneficialP: number;
  readonly oppositeP: number;
}
/** Holds measurements and the exclusion mask fixed; reassigns only complete scheduled blocks. */
export function exactRandomizationTest(
  schedule: Schedule,
  points: readonly RandomizationPoint[],
  direction: 'higher' | 'lower',
): RandomizationResult | null {
  if (schedule.design !== 'randomized') throw new Error('Observational exposure is not randomized');
  if (!['higher', 'lower'].includes(direction)) throw new Error('Invalid test direction');
  const config = {
    totalDays: schedule.totalDays,
    blockLengths: schedule.blockLengths,
    dropFirstNightOfBlock: schedule.dropFirstNightOfBlock,
    minimumNightsPerSide: schedule.minimumNightsPerSide,
  };
  if (!sameJson(schedule, createSchedule(schedule.startDate, schedule.seed, false, config)))
    throw new Error('Schedule is not reproducible');
  const space = enumerateAssignments(schedule.startDate, config);
  if (
    points.some(
      (point) =>
        !Number.isInteger(point.block) ||
        point.block < 0 ||
        point.block >= schedule.blockLengths.length ||
        !Number.isFinite(point.value),
    )
  )
    throw new Error('Invalid randomization measurement');
  const difference = (assignment: readonly ('on' | 'off')[]) => {
    const on = points
      .filter((point) => assignment[point.block] === 'on')
      .map((point) => point.value);
    const off = points
      .filter((point) => assignment[point.block] === 'off')
      .map((point) => point.value);
    return on.length && off.length ? mean(on) - mean(off) : null;
  };
  const statistic = difference(space[schedule.assignmentIndex]!);
  if (statistic === null) return null;
  const sign = direction === 'higher' ? 1 : -1;
  const signed = sign * statistic;
  let beneficialExtreme = 0,
    oppositeExtreme = 0;
  for (const assignment of space) {
    const delta = difference(assignment);
    // Never discard assignments after seeing missingness: that would change the original design.
    if (delta === null) return null;
    const test = sign * delta;
    const tolerance = Number.EPSILON * 64 * Math.max(1, Math.abs(test), Math.abs(signed));
    if (test >= signed - tolerance) beneficialExtreme++;
    if (test <= signed + tolerance) oppositeExtreme++;
  }
  return immutable({
    method: 'exact_scheduled_block_randomization',
    nullHypothesis: 'sharp_no_effect',
    statistic,
    assignmentCount: space.length,
    minimumOneSidedP: 1 / space.length,
    beneficialExtreme,
    oppositeExtreme,
    beneficialP: beneficialExtreme / space.length,
    oppositeP: oppositeExtreme / space.length,
  });
}
