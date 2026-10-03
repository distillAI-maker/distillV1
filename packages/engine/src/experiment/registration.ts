import type { RoutedItem } from '../route/types.js';
import { metricFields } from './baseline.js';
import { createSchedule } from './schedule.js';
import type {
  BaselinePlan,
  BehaviorRule,
  PreRegistration,
  ScheduleConfig,
  TestPolicy,
} from './types.js';
import {
  addDays,
  assertDate,
  immutable,
  localDateTime,
  median,
  nextMonday,
  sameJson,
} from './utils.js';

export interface StartExperimentInput {
  readonly experimentId: string;
  readonly cycleId: string;
  readonly candidate: RoutedItem;
  readonly baseline: BaselinePlan;
  readonly lockedAt: string;
  readonly timeZone: string;
  readonly seed: number;
  readonly direction: 'higher' | 'lower';
  readonly testPolicy?: TestPolicy;
  /** Definitions are explicit and lock the meaning of on/off, including restriction habits. */
  readonly onDefinition: string;
  readonly offDefinition: string;
  readonly config?: ScheduleConfig;
  readonly complianceRule?: BehaviorRule;
}
const carryoverItems = new Set(['alcohol-in-the-evening', 'thc-cannabis-for-sleep']);
const observeOnlyItems = new Set([
  'thc-cannabis-for-sleep',
  'fat-burner-thermogenic',
  'energy-drinks',
  'alcohol-in-the-evening',
  'nicotine-pouches-vape',
  'work-email-after-9pm',
  'weekend-sleep-in-over-1-h',
  'partner-s-snoring-or-schedule',
  'kids-waking-you',
]);
export function validateBehaviorRule(rule: BehaviorRule): void {
  if (rule.matchingExposure !== undefined && !['on', 'off'].includes(rule.matchingExposure))
    throw new Error('Invalid behavior condition mapping');
  if (rule.kind === 'late_workout') {
    if (
      !Number.isFinite(rule.minutesBeforeBed) ||
      rule.minutesBeforeBed <= 0 ||
      rule.minutesBeforeBed > 1440
    )
      throw new Error('Invalid workout window');
  } else if (rule.kind === 'wake_window') {
    if (
      !Number.isInteger(rule.targetMinute) ||
      rule.targetMinute < 0 ||
      rule.targetMinute >= 1440 ||
      !Number.isInteger(rule.toleranceMinutes) ||
      rule.toleranceMinutes < 0 ||
      rule.toleranceMinutes > 720
    )
      throw new Error('Invalid wake window');
  } else if (rule.kind === 'nap') {
    if (
      !Number.isInteger(rule.afterMinute) ||
      rule.afterMinute < 0 ||
      rule.afterMinute >= 1440 ||
      !Number.isFinite(rule.longerThanMinutes) ||
      rule.longerThanMinutes < 0 ||
      rule.longerThanMinutes > 1440
    )
      throw new Error('Invalid nap window');
  } else throw new Error('Unknown behavior rule');
}
export function startExperiment(
  input: StartExperimentInput,
  active: readonly PreRegistration[] = [],
): PreRegistration {
  if (active.length) throw new Error('An experiment is already active');
  const item = input.candidate;
  if (
    item.tier !== 'T1' ||
    item.excluded ||
    item.needsAnswers?.length ||
    item.teamQuestions?.length ||
    !item.metric ||
    !Object.hasOwn(metricFields, item.metric) ||
    !item.onDays
  )
    throw new Error('Only a resolved runnable T1 item can start');
  const today = localDateTime(input.lockedAt, input.timeZone).date;
  const baseline = input.baseline;
  if (
    baseline.status !== 'ready' ||
    !baseline.swing ||
    baseline.metric !== metricFields[item.metric] ||
    baseline.assessedDate !== today ||
    baseline.readyDate > today
  )
    throw new Error('A ready baseline for the selected metric is required');
  if (!baseline.swing.sampleValues)
    throw new Error('Starting a new experiment requires locked baseline measurements');
  if (!['higher', 'lower'].includes(input.direction))
    throw new Error('Explicit metric direction required');
  if (input.complianceRule) validateBehaviorRule(input.complianceRule);
  const config = {
    ...input.config,
    dropFirstNightOfBlock: input.config?.dropFirstNightOfBlock ?? carryoverItems.has(item.key),
  };
  const record: PreRegistration = {
    version: 1,
    experimentId: input.experimentId,
    cycleId: input.cycleId,
    itemId: item.id,
    itemKey: item.key,
    unverified: item.unverified,
    onDays: item.onDays,
    lockedAt: input.lockedAt,
    timeZone: input.timeZone,
    metricName: item.metric,
    metric: metricFields[item.metric]!,
    direction: input.direction,
    alpha: 0.05,
    testPolicy: input.testPolicy ?? 'both_directions',
    onDefinition: input.onDefinition,
    offDefinition: input.offDefinition,
    channel: baseline.channel,
    baseline,
    personalSwing: baseline.swing,
    schedule: createSchedule(nextMonday(today), input.seed, item.onDays === 'observe', config),
    complianceRule: input.complianceRule ?? null,
  };
  assertPreRegistration(record);
  return immutable(record);
}
/** Revalidate persisted JSON and its reproducible schedule before trusting it. */
export function assertPreRegistration(record: PreRegistration): void {
  if (
    record.version !== 1 ||
    !record.experimentId ||
    !record.cycleId ||
    !record.itemId ||
    !record.itemKey ||
    record.alpha !== 0.05 ||
    (record.testPolicy !== undefined &&
      !['benefit_only', 'both_directions'].includes(record.testPolicy)) ||
    !['higher', 'lower'].includes(record.direction) ||
    !Object.hasOwn(metricFields, record.metricName) ||
    metricFields[record.metricName] !== record.metric ||
    typeof record.unverified !== 'boolean' ||
    !record.onDefinition.trim() ||
    !record.offDefinition.trim() ||
    record.onDefinition.length > 1000 ||
    record.offDefinition.length > 1000 ||
    record.onDefinition === record.offDefinition
  )
    throw new Error('Invalid pre-registration');
  const today = localDateTime(record.lockedAt, record.timeZone).date;
  assertDate(record.baseline.requestedDate);
  assertDate(record.baseline.readyDate);
  assertDate(record.baseline.assessedDate);
  record.personalSwing.sampleDates.forEach(assertDate);
  if (
    record.schedule.startDate < today ||
    record.baseline.status !== 'ready' ||
    record.baseline.assessedDate !== today ||
    record.baseline.readyDate > today ||
    record.baseline.metric !== record.metric ||
    !sameJson(record.channel, record.baseline.channel) ||
    !sameJson(record.personalSwing, record.baseline.swing) ||
    record.baseline.usableNights !== record.personalSwing.sampleDates.length ||
    record.baseline.readyDate !==
      (record.baseline.skipped
        ? record.baseline.requestedDate
        : addDays(record.baseline.requestedDate, 7)) ||
    (record.baseline.skipped && record.baseline.usableNights < 28) ||
    !Number.isFinite(record.personalSwing.value) ||
    record.personalSwing.value <= 0 ||
    record.personalSwing.sampleDates.length < 5 ||
    record.personalSwing.sampleDates.some((date) => date > today) ||
    new Set(record.personalSwing.sampleDates).size !== record.personalSwing.sampleDates.length ||
    record.personalSwing.scale !== (record.metric === 'overnightHrvMs' ? 'log' : 'raw')
  )
    throw new Error('Invalid locked baseline');
  if (record.metric === 'overnightHrvMs' && !record.channel.hrvMethod)
    throw new Error('HRV method required');
  const values = record.personalSwing.sampleValues;
  if (values !== undefined) {
    if (
      values.length !== record.personalSwing.sampleDates.length ||
      values.some(
        (value) =>
          !Number.isFinite(value) ||
          (record.metric === 'overnightHrvMs' && value <= 0) ||
          (record.metric === 'sleepLatencyMinutes' && (value < 0 || value > 60)),
      )
    )
      throw new Error('Invalid locked baseline measurements');
    const transformed = values.map((value) =>
      record.metric === 'overnightHrvMs' ? Math.log(value) : value,
    );
    const center = median(transformed);
    const swing = median(transformed.map((value) => Math.abs(value - center))) * 1.4826;
    if (Math.abs(swing - record.personalSwing.value) > Number.EPSILON * 64 * Math.max(1, swing))
      throw new Error('Locked baseline measurements do not match personal swing');
  }
  const schedule = createSchedule(
    record.schedule.startDate,
    record.schedule.seed,
    record.schedule.design === 'observational',
    {
      totalDays: record.schedule.totalDays,
      blockLengths: record.schedule.blockLengths,
      dropFirstNightOfBlock: record.schedule.dropFirstNightOfBlock,
      minimumNightsPerSide: record.schedule.minimumNightsPerSide,
    },
  );
  if (!sameJson(schedule, record.schedule))
    throw new Error('Schedule does not match its locked seed/config');
  if (
    !['assign', 'observe'].includes(record.onDays) ||
    (record.onDays === 'observe') !== (record.schedule.design === 'observational')
  )
    throw new Error('Observation mode does not match the schedule');
  if (observeOnlyItems.has(record.itemKey) && record.schedule.design !== 'observational')
    throw new Error('Observe-only item cannot have assigned on-days');
  if (record.complianceRule) validateBehaviorRule(record.complianceRule);
}
/** A switch closes the old test and creates a new record; it never changes the old metric/schedule. */
export function switchExperiment(current: PreRegistration, input: StartExperimentInput) {
  assertPreRegistration(current);
  if (
    input.experimentId === current.experimentId ||
    input.cycleId !== current.cycleId ||
    input.candidate.id === current.itemId ||
    +new Date(input.lockedAt) < +new Date(current.lockedAt)
  )
    throw new Error('Invalid experiment switch');
  return immutable({
    previousExperimentId: current.experimentId,
    stoppedAt: input.lockedAt,
    next: startExperiment(input),
  });
}
