import { measurement } from '../experiment/baseline.js';
import { assertPreRegistration } from '../experiment/registration.js';
import type { CheckIn, HistoricalNight, PreRegistration } from '../experiment/types.js';
import { assertDate, immutable } from '../experiment/utils.js';
import { bootstrapInterval } from './bootstrap.js';
import { decideVerdict } from './decision.js';
import { mean, robustSd } from './math.js';
import { exactRandomizationTest } from './randomization.js';
import type { AnalysisInput, AnalysisResult, AnalysisSwing, InconclusiveReason } from './types.js';

interface Sample {
  readonly sleepDate: string;
  readonly block: number;
  readonly exposure: 'on' | 'off';
  readonly raw: number;
  readonly transformed: number;
}
const transform = (value: number, record: PreRegistration) =>
  record.metric === 'overnightHrvMs' ? Math.log(value) : value;

function baselineValues(record: PreRegistration, nights: readonly HistoricalNight[]) {
  if (record.personalSwing.sampleValues)
    return {
      values: [...record.personalSwing.sampleValues],
      source: 'locked_snapshot' as const,
    };
  // Legacy registrations have dates and a swing but no raw snapshot. Never substitute later nights.
  const values: number[] = [];
  for (const date of record.personalSwing.sampleDates) {
    const matching = nights
      .filter((row) => row.night.sleepDate === date)
      .map((row) => measurement(row, record.metric, record.channel))
      .filter((value) => value !== null);
    if (matching.length > 1) throw new Error('Duplicate legacy baseline measurement');
    if (!matching.length) return null;
    values.push(matching[0]!);
  }
  const swing = robustSd(values.map((value) => transform(value, record)));
  if (Math.abs(swing - record.personalSwing.value) > Number.EPSILON * 64 * Math.max(1, swing))
    return null;
  return { values, source: 'legacy_history_verified' as const };
}
function validateCheckIn(entry: CheckIn, record: PreRegistration): void {
  const day = record.schedule.days.find((day) => day.sleepDate === entry.sleepDate);
  if (!day) throw new Error('Check-in outside saved schedule');
  if (
    !['on', 'off', 'unknown'].includes(entry.exposure) ||
    !['did', 'didnt', 'unknown'].includes(entry.tap) ||
    !['tap', 'wearable', 'confirmed_tag', 'self_report', 'unknown'].includes(entry.provenance) ||
    entry.exclusions.some(
      (flag) => !['ill', 'travelling', 'kids_woke_me', 'unusually_hard_session'].includes(flag),
    ) ||
    entry.excludedForCarryover !== day.excludedForCarryover ||
    entry.usable !==
      (entry.exposure !== 'unknown' && !entry.exclusions.length && !day.excludedForCarryover) ||
    (entry.exposure === 'unknown') !== (entry.provenance === 'unknown')
  )
    throw new Error('Invalid persisted check-in');
}
function selectedChannel(row: HistoricalNight, record: PreRegistration): boolean {
  return (
    row.night.source === record.channel.source &&
    (record.channel.deviceModel === undefined ||
      row.night.deviceModel === record.channel.deviceModel) &&
    (record.metric !== 'overnightHrvMs' || row.night.hrvMethod === record.channel.hrvMethod)
  );
}
export function analyzeExperiment(input: AnalysisInput): AnalysisResult {
  const record = input.registration;
  assertPreRegistration(record);
  assertDate(input.through);
  const schedule = record.schedule;
  const savedDates = new Set(schedule.days.map((day) => day.sleepDate));
  const entries = new Map<string, CheckIn>();
  for (const entry of input.checkIns) {
    validateCheckIn(entry, record);
    if (entries.has(entry.sleepDate)) throw new Error('Duplicate check-in date');
    entries.set(entry.sleepDate, entry);
  }
  const byDate = new Map<string, HistoricalNight>();
  for (const row of input.nights) {
    assertDate(row.night.sleepDate);
    if (!savedDates.has(row.night.sleepDate) || !selectedChannel(row, record)) continue;
    if (byDate.has(row.night.sleepDate)) throw new Error('Duplicate experiment measurement');
    byDate.set(row.night.sleepDate, row);
  }
  const excluded: AnalysisResult['excluded'][number][] = [];
  const samples: Sample[] = [];
  const noncompliantDates: string[] = [];
  for (const day of schedule.days) {
    const entry = entries.get(day.sleepDate),
      row = byDate.get(day.sleepDate);
    const exclude = (reason: AnalysisResult['excluded'][number]['reason']) =>
      excluded.push({ sleepDate: day.sleepDate, reason });
    if (day.sleepDate > input.through) {
      exclude('not_yet_observed');
      continue;
    }
    if (day.excludedForCarryover) {
      exclude('carryover');
      continue;
    }
    if (entry?.exclusions.length || row?.exclusions?.length) {
      exclude('flagged');
      continue;
    }
    if (!entry || entry.exposure === 'unknown') {
      exclude('unknown_exposure');
      continue;
    }
    const value = row ? measurement(row, record.metric, record.channel) : null;
    if (value === null) {
      exclude('measurement_unavailable');
      continue;
    }
    if (schedule.design === 'randomized' && entry.exposure !== day.condition)
      noncompliantDates.push(day.sleepDate);
    samples.push({
      sleepDate: day.sleepDate,
      block: day.block,
      exposure: entry.exposure,
      raw: value,
      transformed: transform(value, record),
    });
  }
  const on = samples.filter((sample) => sample.exposure === 'on');
  const off = samples.filter((sample) => sample.exposure === 'off');
  const baseline = baselineValues(record, input.nights);
  const swing: AnalysisSwing | null = baseline
    ? {
        value: robustSd([
          ...baseline.values.map((value) => transform(value, record)),
          ...off.map((sample) => sample.transformed),
        ]),
        scale: record.personalSwing.scale,
        baselineNights: baseline.values.length,
        offNights: off.length,
        baselineSource: baseline.source,
      }
    : null;
  const effect =
    on.length && off.length
      ? {
          onMean: mean(on.map((sample) => sample.raw)),
          offMean: mean(off.map((sample) => sample.raw)),
          difference: mean(on.map((sample) => sample.raw)) - mean(off.map((sample) => sample.raw)),
          transformedDifference:
            mean(on.map((sample) => sample.transformed)) -
            mean(off.map((sample) => sample.transformed)),
          swingUnits:
            swing && swing.value > 0
              ? (mean(on.map((sample) => sample.transformed)) -
                  mean(off.map((sample) => sample.transformed))) /
                swing.value
              : null,
        }
      : null;
  const grouped = (condition: 'on' | 'off') => {
    const blocks = new Map<number, number[]>();
    for (const sample of samples.filter((sample) => sample.exposure === condition)) {
      const values = blocks.get(sample.block) ?? [];
      values.push(sample.raw);
      blocks.set(sample.block, values);
    }
    return [...blocks.values()];
  };
  const offBlocks = new Set(off.map((sample) => sample.block));
  const mixedExposureBlocks = on.some((sample) => offBlocks.has(sample.block));
  // Independent condition strata cannot resample a cluster that belongs to both sides.
  const interval = bootstrapInterval(
    mixedExposureBlocks ? [] : grouped('on'),
    mixedExposureBlocks ? [] : grouped('off'),
    {
      seed: input.bootstrap?.seed ?? (schedule.seed ^ 0xa5a5a5a5) >>> 0,
      iterations: input.bootstrap?.iterations,
    },
  );
  const testPolicy = record.testPolicy ?? 'benefit_only';
  const perTailAlpha = testPolicy === 'both_directions' ? record.alpha / 2 : record.alpha;
  const blockers: InconclusiveReason[] = [];
  if (input.through < schedule.days.at(-1)!.sleepDate) blockers.push('experiment_not_finished');
  if (on.length < schedule.minimumNightsPerSide || off.length < schedule.minimumNightsPerSide)
    blockers.push('insufficient_nights');
  if (schedule.design === 'observational') blockers.push('observational_design');
  if (noncompliantDates.length) blockers.push('noncompliance');
  if (!baseline) blockers.push('baseline_unavailable');
  else if (!swing || swing.value <= 0) blockers.push('zero_personal_swing');
  if (effect && Math.sign(effect.difference) !== Math.sign(effect.transformedDifference))
    blockers.push('effect_direction_disagreement');
  const randomization =
    schedule.design === 'randomized' && !noncompliantDates.length && samples.length
      ? exactRandomizationTest(
          schedule,
          samples.map((sample) => ({ block: sample.block, value: sample.transformed })),
          record.direction,
        )
      : null;
  if (schedule.design === 'randomized') {
    if (1 / schedule.assignmentCount >= perTailAlpha) blockers.push('assignment_resolution');
    if (!randomization) blockers.push('randomization_not_estimable');
  }
  const decision = decideVerdict({
    direction: record.direction,
    testPolicy,
    alpha: record.alpha,
    difference: effect?.transformedDifference ?? null,
    test: randomization,
    blockers,
  });
  return immutable({
    version: 1,
    experimentId: record.experimentId,
    itemId: record.itemId,
    itemKey: record.itemKey,
    unverified: record.unverified,
    metricName: record.metricName,
    metric: record.metric,
    direction: record.direction,
    onDefinition: record.onDefinition,
    offDefinition: record.offDefinition,
    design: schedule.design,
    testPolicy,
    through: input.through,
    alpha: record.alpha,
    perTailAlpha,
    ...decision,
    validNights: { on: on.length, off: off.length },
    excluded,
    noncompliantDates,
    effect,
    personalSwing: swing,
    lockedSwing: record.personalSwing,
    randomization,
    interval,
    validation: 'awaiting_phase_6',
    limitations: [
      'protocol_and_interval_coverage_await_phase_6',
      'randomization_tests_sharp_no_effect_not_all_average_effect_nulls',
      ...(excluded.some(
        (entry) => entry.reason !== 'carryover' && entry.reason !== 'not_yet_observed',
      )
        ? ['fixed_exclusion_mask_requires_assignment_independent_missingness']
        : []),
      ...(schedule.design === 'observational'
        ? ['observed_exposure_is_not_a_randomized_condition']
        : []),
      ...(noncompliantDates.length ? ['actual_exposure_does_not_match_randomized_assignment'] : []),
      ...(mixedExposureBlocks
        ? ['bootstrap_condition_clusters_overlap']
        : !interval
          ? ['bootstrap_requires_two_observed_blocks_per_condition']
          : []),
    ],
  });
}
