import type { Condition, Schedule, ScheduleConfig } from './types.js';
import { addDays, immutable, weekday } from './utils.js';

const layouts = (config: ScheduleConfig) => {
  const total = config.totalDays ?? 14;
  const block = config.blockLength ?? 3;
  if (
    !Number.isInteger(total) ||
    total < 10 ||
    total > 56 ||
    total % 2 ||
    !Number.isInteger(block) ||
    block < 1
  )
    throw new Error('Invalid schedule dimensions');
  const lengths = config.blockLengths
    ? [...config.blockLengths]
    : total === 14 && block === 3
      ? config.dropFirstNightOfBlock
        ? [3, 3, 4, 4]
        : [3, 3, 3, 3, 1, 1]
      : [
          ...Array(Math.floor(total / block)).fill(block),
          ...(total % block ? [total % block] : []),
        ];
  if (
    lengths.length > 16 ||
    lengths.length < 2 ||
    lengths.some((n) => !Number.isInteger(n) || n < 1) ||
    lengths.reduce((sum, n) => sum + n, 0) !== total
  )
    throw new Error('Invalid block layout');
  return { total, lengths };
};

/** Full constrained support, used by both randomization and the future exact test. */
export function enumerateAssignments(
  startDate: string,
  config: ScheduleConfig = {},
): readonly (readonly ('on' | 'off')[])[] {
  if (weekday(startDate) !== 1) throw new Error('Experiments must start on Monday');
  const { total, lengths } = layouts(config);
  const minimum = config.minimumNightsPerSide ?? 5;
  if (!Number.isInteger(minimum) || minimum < 5)
    throw new Error('At least five valid nights per side are required');
  // Calendar membership is fixed across the entire randomization space.
  let calendarOffset = 0;
  const weekendsByBlock = lengths.map((length) => {
    let weekends = 0;
    for (let day = 0; day < length; day++)
      if ([0, 6].includes(weekday(addDays(startDate, calendarOffset + day)))) weekends++;
    calendarOffset += length;
    return weekends;
  });
  const assignments: ('on' | 'off')[][] = [];
  for (let mask = 0; mask < 2 ** lengths.length; mask++) {
    const assignment = lengths.map((_, index) =>
      mask & (1 << index) ? ('on' as const) : ('off' as const),
    );
    if (
      assignment.some(
        (condition, i) =>
          i >= 2 && condition === assignment[i - 1] && condition === assignment[i - 2],
      )
    )
      continue;
    let on = 0,
      usableOn = 0,
      usableOff = 0,
      weekendOn = 0,
      weekendOff = 0;
    lengths.forEach((length, block) => {
      const active = assignment[block] === 'on';
      if (active) on += length;
      if (active) usableOn += length - (config.dropFirstNightOfBlock ? 1 : 0);
      else usableOff += length - (config.dropFirstNightOfBlock ? 1 : 0);
      if (active) weekendOn += weekendsByBlock[block]!;
      else weekendOff += weekendsByBlock[block]!;
    });
    if (
      on === total / 2 &&
      usableOn >= minimum &&
      usableOff >= minimum &&
      Math.abs(weekendOn - weekendOff) <= 1
    )
      assignments.push(assignment);
  }
  if (!assignments.length)
    throw new Error('No balanced schedule meets weekend, block and usable-night constraints');
  return immutable(assignments);
}

/** Rejection sampling prevents modulo bias when selecting from the exact support. */
function uniformIndex(seed: number, count: number): number {
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)
    throw new Error('Seed must be a uint32');
  let state = seed;
  const limit = Math.floor(0x100000000 / count) * count;
  for (;;) {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    const next = (value ^ (value >>> 14)) >>> 0;
    if (next < limit) return next % count;
  }
}
export function createSchedule(
  startDate: string,
  seed: number,
  observeOnly: boolean,
  config: ScheduleConfig = {},
): Schedule {
  const { total, lengths } = layouts(config);
  const space = enumerateAssignments(startDate, config);
  const assignmentIndex = uniformIndex(seed, space.length);
  const assignment = space[assignmentIndex]!;
  const days: Schedule['days'][number][] = [];
  let offset = 0;
  lengths.forEach((length, block) => {
    const condition: Condition =
      observeOnly && assignment[block] === 'on' ? 'observe' : assignment[block]!;
    for (let day = 0; day < length; day++) {
      const date = addDays(startDate, offset++);
      days.push({
        date,
        sleepDate: addDays(date, 1),
        block,
        condition,
        excludedForCarryover: !!config.dropFirstNightOfBlock && day === 0,
      });
    }
  });
  return immutable({
    version: 1,
    startDate,
    seed,
    totalDays: total,
    blockLengths: lengths,
    dropFirstNightOfBlock: !!config.dropFirstNightOfBlock,
    minimumNightsPerSide: config.minimumNightsPerSide ?? 5,
    design: observeOnly ? 'observational' : 'randomized',
    assignmentIndex,
    assignmentCount: space.length,
    minimumAttainableOneSidedP: observeOnly ? null : 1 / space.length,
    limitations: [
      ...(space.length <= 20 && !observeOnly ? ['assignment_space_cannot_reach_p_below_0_05'] : []),
      ...(observeOnly
        ? [
            'observational_conditions_are_not_randomized_exposures',
            'observed_on_nights_are_not_guaranteed',
          ]
        : []),
    ],
    days,
  });
}
