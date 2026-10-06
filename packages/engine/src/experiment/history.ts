import type { NightRecord, Tag, Workout } from '@distill/providers';
import type { RoutedItem } from '../route/types.js';
import { measurement, metricFields, usableHistory } from './baseline.js';
import { validateBehaviorRule } from './registration.js';
import type {
  BehaviorObservation,
  BehaviorRule,
  DataChannel,
  HistoricalNight,
  MetricField,
} from './types.js';
import { immutable, localDateTime, median } from './utils.js';

export interface EventCoverage {
  readonly from: string;
  readonly to: string;
}
export interface NapEpisode {
  readonly start: string;
  readonly end: string;
}
export function inferBehavior(
  night: NightRecord,
  timeZone: string,
  rule: BehaviorRule,
  events: {
    readonly workouts?: readonly Workout[];
    readonly naps?: readonly NapEpisode[];
    readonly coverage?: EventCoverage;
  } = {},
): BehaviorObservation {
  validateBehaviorRule(rule);
  const matching = rule.matchingExposure ?? 'on';
  const opposite = matching === 'on' ? 'off' : 'on';
  const unknown: BehaviorObservation = {
    sleepDate: night.sleepDate,
    exposure: 'unknown',
    provenance: 'wearable',
    confirmed: false,
  };
  if (!night.sleepEnd || !night.sleepStart) return unknown;
  const wake = localDateTime(night.sleepEnd, timeZone);
  if (wake.date !== night.sleepDate) return unknown;
  if (rule.kind === 'wake_window') {
    const distance = Math.abs(wake.minute - rule.targetMinute);
    return {
      ...unknown,
      confirmed: true,
      exposure: Math.min(distance, 1440 - distance) <= rule.toleranceMinutes ? matching : opposite,
    };
  }
  const bedtime = +new Date(night.sleepStart);
  if (!Number.isFinite(bedtime) || bedtime >= +new Date(night.sleepEnd)) return unknown;
  const from = bedtime - 86400000;
  const full =
    !!events.coverage &&
    +new Date(events.coverage.from) <= from &&
    +new Date(events.coverage.to) >= bedtime;
  let on: boolean;
  if (rule.kind === 'late_workout') {
    on = (events.workouts ?? []).some((workout) => {
      if (workout.source !== night.source || !workout.end) return false;
      const start = +new Date(workout.start),
        end = +new Date(workout.end);
      return (
        Number.isFinite(start) &&
        start <= end &&
        end <= bedtime &&
        end >= bedtime - rule.minutesBeforeBed * 60000
      );
    });
  } else {
    on = (events.naps ?? []).some((nap) => {
      const start = +new Date(nap.start),
        end = +new Date(nap.end);
      if (
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < from ||
        end > bedtime ||
        end <= start
      )
        return false;
      const minute = localDateTime(nap.start, timeZone).minute;
      return minute > rule.afterMinute || (end - start) / 60000 > rule.longerThanMinutes;
    });
  }
  return immutable({
    ...unknown,
    exposure: on ? matching : full ? opposite : 'unknown',
    confirmed: on || full,
  });
}
/** Absence of a tag is not an off-night: users need not tag every occurrence. */
export function observationFromTags(
  night: NightRecord,
  tags: readonly Tag[],
  labels: {
    readonly on: readonly string[];
    readonly off: readonly string[];
  },
): BehaviorObservation {
  const unknown: BehaviorObservation = {
    sleepDate: night.sleepDate,
    exposure: 'unknown',
    provenance: 'confirmed_tag',
    confirmed: false,
  };
  if (!night.sleepStart || !night.sleepEnd) return unknown;
  const from = +new Date(night.sleepStart) - 86400000,
    to = +new Date(night.sleepEnd);
  const relevant = tags.filter(
    (tag) =>
      tag.source === night.source && +new Date(tag.start) >= from && +new Date(tag.start) < to,
  );
  const has = (list: readonly string[]) =>
    relevant.some((tag) => tag.labels.some((label) => list.includes(label)));
  const on = has(labels.on),
    off = has(labels.off);
  if (on === off) return unknown;
  return { ...unknown, exposure: on ? 'on' : 'off', confirmed: true };
}
export function alcoholSignature(
  night: NightRecord,
  reference: {
    readonly channel: DataChannel;
    readonly hrvMs: number;
    readonly restingHeartRateBpm: number;
    readonly temperatureDeviationC: number;
  },
): BehaviorObservation | null {
  if (
    night.source !== reference.channel.source ||
    !reference.channel.hrvMethod ||
    night.hrvMethod !== reference.channel.hrvMethod ||
    (reference.channel.deviceModel !== undefined &&
      night.deviceModel !== reference.channel.deviceModel)
  )
    return null;
  if (
    ![reference.hrvMs, reference.restingHeartRateBpm, reference.temperatureDeviationC].every(
      Number.isFinite,
    )
  )
    throw new Error('Invalid alcohol reference');
  if (
    night.overnightHrvMs === null ||
    night.restingHeartRateBpm === null ||
    night.skinTemperatureDeviationC === null
  )
    return null;
  if (
    night.overnightHrvMs < reference.hrvMs &&
    night.restingHeartRateBpm > reference.restingHeartRateBpm &&
    night.skinTemperatureDeviationC > reference.temperatureDeviationC
  )
    return {
      sleepDate: night.sleepDate,
      exposure: 'unknown',
      provenance: 'alcohol_signature',
      confirmed: false,
    };
  return null;
}
export function confirmAlcoholSignature(
  suggestion: BehaviorObservation,
  happened: boolean,
): BehaviorObservation {
  if (suggestion.provenance !== 'alcohol_signature' || suggestion.confirmed)
    throw new Error('Not an unconfirmed alcohol suggestion');
  return immutable({
    ...suggestion,
    exposure: happened ? 'on' : 'off',
    provenance: 'self_report',
    confirmed: true,
  });
}
export function historyHypothesis(
  history: readonly HistoricalNight[],
  observations: readonly BehaviorObservation[],
  metric: MetricField,
  channel: DataChannel,
  through: string,
) {
  const usable = usableHistory(history, metric, channel, through);
  const byDate = new Map<string, BehaviorObservation>();
  for (const observation of observations) {
    if (byDate.has(observation.sleepDate)) throw new Error('Duplicate historical behavior date');
    byDate.set(observation.sleepDate, observation);
  }
  const confirmed = (date: string) => {
    const observation = byDate.get(date);
    return observation?.confirmed && observation.provenance !== 'alcohol_signature';
  };
  const on = usable.filter((row) => confirmed(row.date) && byDate.get(row.date)?.exposure === 'on');
  const off = usable.filter(
    (row) => confirmed(row.date) && byDate.get(row.date)?.exposure === 'off',
  );
  if (on.length < 5 || off.length < 5) return null;
  const mean = (values: readonly number[]) =>
    values.reduce((sum, value) => sum + value, 0) / values.length;
  const transform = (value: number) => (metric === 'overnightHrvMs' ? Math.log(value) : value);
  const offValues = off.map((row) => transform(row.value)),
    center = median(offValues);
  const swing = median(offValues.map((value) => Math.abs(value - center))) * 1.4826;
  const difference = mean(on.map((row) => row.value)) - mean(off.map((row) => row.value));
  const standardizedDifference =
    swing > 0 ? (mean(on.map((row) => transform(row.value))) - mean(offValues)) / swing : null;
  return immutable({
    label: 'hypothesis' as const,
    randomized: false as const,
    metric,
    channel,
    onNights: on.length,
    offNights: off.length,
    onMean: mean(on.map((row) => row.value)),
    offMean: mean(off.map((row) => row.value)),
    difference,
    standardizedDifference,
    strength: standardizedDifference === null ? null : Math.abs(standardizedDifference),
    dates: [...on, ...off].map((row) => row.date).sort(),
  });
}
export function historyDataQuality(
  history: readonly HistoricalNight[],
  metric: MetricField,
  channel: DataChannel,
): number {
  const eligible = history.filter(
    (row) =>
      row.night.source === channel.source &&
      (channel.deviceModel === undefined || row.night.deviceModel === channel.deviceModel) &&
      (metric !== 'overnightHrvMs' ||
        row.night.hrvMethod === null ||
        row.night.hrvMethod === channel.hrvMethod),
  );
  if (!eligible.length) return 0;
  return (
    eligible.filter((row) => measurement(row, metric, channel) !== null).length / eligible.length
  );
}
/** UI-facing history stays attached to a resolved, non-Protected item and its chosen metric. */
export function itemHistoryHypothesis(
  item: RoutedItem,
  history: readonly HistoricalNight[],
  observations: readonly BehaviorObservation[],
  channel: DataChannel,
  through: string,
) {
  if (
    item.tier === 'PROTECTED' ||
    item.excluded ||
    item.needsAnswers?.length ||
    item.teamQuestions?.length ||
    !item.metric ||
    !Object.hasOwn(metricFields, item.metric)
  )
    return null;
  const result = historyHypothesis(
    history,
    observations,
    metricFields[item.metric]!,
    channel,
    through,
  );
  return result
    ? immutable({
        ...result,
        itemId: item.id,
        itemKey: item.key,
        metricName: item.metric,
        unverified: item.unverified,
      })
    : null;
}
