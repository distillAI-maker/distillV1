import { measurement } from '../experiment/baseline.js';
import { assertPreRegistration } from '../experiment/registration.js';
import type { CheckIn, HistoricalNight, PreRegistration } from '../experiment/types.js';
import { addDays, assertDate, immutable } from '../experiment/utils.js';
import { bootstrapInterval } from './bootstrap.js';
import { decideVerdict } from './decision.js';
import { estimateEffect } from './estimate.js';
import type { EffectEstimateV2, NightSample } from './estimate.js';
import { mean, robustSd } from './math.js';
import { decideFromEstimate } from './policy.js';
import type { Outcome } from './policy.js';
import { exactRandomizationTest } from './randomization.js';
import type {
  AnalysisInput,
  AnalysisResult,
  AnalysisSwing,
  InconclusiveReason,
  Verdict,
} from './types.js';

interface Sample {
  readonly sleepDate: string;
  readonly block: number;
  readonly dayIndex: number;
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
function swingOf(
  record: PreRegistration,
  baseline: { values: number[]; source: AnalysisSwing['baselineSource'] } | null,
  off: readonly Sample[],
): AnalysisSwing | null {
  return baseline
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
}
function effectOf(on: readonly Sample[], off: readonly Sample[], swing: AnalysisSwing | null) {
  return on.length && off.length
    ? {
        onMean: mean(on.map((sample) => sample.raw)),
        offMean: mean(off.map((sample) => sample.raw)),
        difference: mean(on.map((sample) => sample.raw)) - mean(off.map((sample) => sample.raw)),
        transformedDifference:
          mean(on.map((sample) => sample.transformed)) - mean(off.map((sample) => sample.transformed)),
        swingUnits:
          swing && swing.value > 0
            ? (mean(on.map((sample) => sample.transformed)) -
                mean(off.map((sample) => sample.transformed))) /
              swing.value
            : null,
      }
    : null;
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
  schedule.days.forEach((day, dayIndex) => {
    const entry = entries.get(day.sleepDate),
      row = byDate.get(day.sleepDate);
    const exclude = (reason: AnalysisResult['excluded'][number]['reason']) =>
      excluded.push({ sleepDate: day.sleepDate, reason });
    if (day.sleepDate > input.through) return exclude('not_yet_observed');
    if (day.excludedForCarryover) return exclude('carryover');
    if (entry?.exclusions.length || row?.exclusions?.length) return exclude('flagged');
    if (!entry || entry.exposure === 'unknown') return exclude('unknown_exposure');
    const value = row ? measurement(row, record.metric, record.channel) : null;
    if (value === null) return exclude('measurement_unavailable');
    if (schedule.design === 'randomized' && entry.exposure !== day.condition)
      noncompliantDates.push(day.sleepDate);
    samples.push({
      sleepDate: day.sleepDate,
      block: day.block,
      dayIndex,
      exposure: entry.exposure,
      raw: value,
      transformed: transform(value, record),
    });
  });
  const baseline = baselineValues(record, input.nights);
  const testPolicy = record.testPolicy ?? 'benefit_only';
  const perTailAlpha = testPolicy === 'both_directions' ? record.alpha / 2 : record.alpha;
  const base = {
    version: 1 as const,
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
    lockedSwing: record.personalSwing,
    validation: 'simulation_evidence_available' as const,
  };

  if (record.decision) {
    // ---- Estimate-based decision (policy estimate_v2) ----
    const lock = record.decision;
    const reached = lock.looks.filter((date) => date <= input.through);
    const lookDate = reached.at(-1) ?? null;
    const lookIndex = reached.length ? reached.length - 1 : null;
    const complete = lookDate === lock.looks.at(-1);
    const next = complete ? null : (lock.looks[reached.length] ?? null);
    const window = lookDate ? samples.filter((s) => s.sleepDate <= lookDate) : [];
    // An observed on-night carries into the next night for items that linger; drop that off-night.
    const onDates = new Set(window.filter((s) => s.exposure === 'on').map((s) => s.sleepDate));
    const usable = window.filter(
      (s) =>
        !(
          lock.carryover &&
          schedule.design === 'observational' &&
          s.exposure === 'off' &&
          onDates.has(addDays(s.sleepDate, -1))
        ),
    );
    for (const s of window)
      if (!usable.includes(s)) excluded.push({ sleepDate: s.sleepDate, reason: 'carryover' });
    const on = usable.filter((s) => s.exposure === 'on');
    const off = usable.filter((s) => s.exposure === 'off');
    const swing = swingOf(record, baseline, off);
    const effect = effectOf(on, off, swing);
    const blockers: InconclusiveReason[] = [];
    if (!baseline) blockers.push('baseline_unavailable');
    else if (!swing || swing.value <= 0) blockers.push('zero_personal_swing');
    if (effect && Math.sign(effect.difference) !== Math.sign(effect.transformedDifference))
      blockers.push('effect_direction_disagreement');
    const nightsOk =
      on.length >= lock.policy.minimumNightsPerSide && off.length >= lock.policy.minimumNightsPerSide;
    let estimate: EffectEstimateV2 | null = null;
    if (on.length && off.length && swing && swing.value > 0)
      estimate = estimateEffect({
        samples: usable.map(
          (s): NightSample => ({
            sleepDate: s.sleepDate,
            dayIndex: s.dayIndex,
            exposure: s.exposure,
            value: s.transformed,
          }),
        ),
        swing: swing.value,
        rho: lock.rho.value,
        prior: lock.prior,
        direction: record.direction,
        inflation: schedule.design === 'observational' ? lock.policy.observedInflation : 1,
        balanceWeekends: schedule.design === 'observational',
        worthwhile: lock.policy.worthwhileEffect,
      });
    let verdict: Verdict, outcome: Outcome;
    let reasons: InconclusiveReason[];
    let leans: 'help' | 'harm' | undefined;
    if (blockers.length) {
      verdict = 'Inconclusive';
      outcome = lookDate ? 'not_enough_nights' : 'in_progress';
      reasons = [...new Set(blockers)];
    } else {
      const decided = decideFromEstimate(estimate, {
        policy: lock.policy,
        design: schedule.design,
        complete,
        atLook: lookDate !== null,
        nightsOk,
      });
      verdict = decided.verdict;
      outcome = decided.outcome;
      leans = decided.leans;
      reasons = verdict === 'Inconclusive' ? [outcome as InconclusiveReason] : [];
    }
    const assigned = schedule.design === 'randomized' ? usable : [];
    const deviations = assigned.filter(
      (s) => schedule.days[s.dayIndex]!.condition !== s.exposure,
    ).length;
    return immutable({
      ...base,
      verdict,
      reasons,
      validNights: { on: on.length, off: off.length },
      excluded,
      noncompliantDates: noncompliantDates.filter((date) => !lookDate || date <= lookDate),
      effect,
      personalSwing: swing,
      randomization: null,
      interval: null,
      estimate,
      outcome,
      ...(leans ? { leans } : {}),
      look: { index: lookIndex, date: lookDate, next, complete },
      deviationShare: assigned.length ? deviations / assigned.length : null,
      limitations: [
        'simulation_is_conditional_on_declared_model_not_real_user_validation',
        'actual_exposure_is_analyzed_as_treated',
        ...(schedule.design === 'observational'
          ? ['observed_exposure_is_not_a_randomized_condition', 'standard_error_inflated_for_confounding']
          : []),
        ...(lock.rho.basis === 'default' ? ['night_correlation_assumed_not_estimated'] : []),
      ],
    });
  }

  // ---- Legacy: exact randomization test over the scheduled block assignments ----
  const on = samples.filter((sample) => sample.exposure === 'on');
  const off = samples.filter((sample) => sample.exposure === 'off');
  const swing = swingOf(record, baseline, off);
  const effect = effectOf(on, off, swing);
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
  const interval =
    input.bootstrap?.enabled === false
      ? null
      : bootstrapInterval(
          mixedExposureBlocks ? [] : grouped('on'),
          mixedExposureBlocks ? [] : grouped('off'),
          {
            seed: input.bootstrap?.seed ?? (schedule.seed ^ 0xa5a5a5a5) >>> 0,
            iterations: input.bootstrap?.iterations,
          },
        );
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
    ...base,
    ...decision,
    validNights: { on: on.length, off: off.length },
    excluded,
    noncompliantDates,
    effect,
    personalSwing: swing,
    randomization,
    interval,
    estimate: null,
    outcome: null,
    look: null,
    deviationShare: null,
    limitations: [
      'simulation_is_conditional_on_declared_model_not_real_user_validation',
      'bootstrap_interval_coverage_not_established',
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
      ...(input.bootstrap?.enabled === false
        ? ['bootstrap_not_requested']
        : mixedExposureBlocks
          ? ['bootstrap_condition_clusters_overlap']
          : !interval
            ? ['bootstrap_requires_two_observed_blocks_per_condition']
            : []),
    ],
  });
}
