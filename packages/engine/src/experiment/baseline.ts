import type {
  BaselinePlan,
  DataChannel,
  HistoricalNight,
  MetricField,
  SwingEstimate,
} from './types.js';
import { addDays, assertDate, immutable, median } from './utils.js';

export const metricFields: Readonly<Record<string, MetricField>> = {
  'Total sleep': 'totalSleepMinutes',
  'Time to fall asleep': 'sleepLatencyMinutes',
  'Deep sleep': 'deepSleepMinutes',
  'REM sleep': 'remSleepMinutes',
  'Time awake during the night': 'wakeAfterSleepOnsetMinutes',
  'Share of time in bed asleep': 'sleepEfficiencyPercent',
  'Overnight HRV': 'overnightHrvMs',
  'Resting heart rate': 'restingHeartRateBpm',
  'Breathing rate': 'breathingRatePerMinute',
  'Skin temperature': 'skinTemperatureDeviationC',
};
export function measurement(
  row: HistoricalNight,
  metric: MetricField,
  channel: DataChannel,
): number | null {
  const night = row.night;
  assertDate(night.sleepDate);
  if (
    night.source !== channel.source ||
    row.exclusions?.length ||
    (channel.deviceModel !== undefined && night.deviceModel !== channel.deviceModel) ||
    (metric === 'overnightHrvMs' && (!channel.hrvMethod || channel.hrvMethod !== night.hrvMethod))
  )
    return null;
  const value = night[metric];
  if (
    value === null ||
    !Number.isFinite(value) ||
    (metric === 'sleepLatencyMinutes' && value > 60) ||
    (metric === 'overnightHrvMs' && value <= 0)
  )
    return null;
  return value;
}
export function usableHistory(
  history: readonly HistoricalNight[],
  metric: MetricField,
  channel: DataChannel,
  through: string,
) {
  assertDate(through);
  const seen = new Set<string>();
  const rows: { date: string; value: number }[] = [];
  for (const row of history) {
    const value = measurement(row, metric, channel);
    if (row.night.sleepDate > through || value === null) continue;
    if (seen.has(row.night.sleepDate))
      throw new Error('Multiple usable measurements for one date/channel');
    seen.add(row.night.sleepDate);
    rows.push({ date: row.night.sleepDate, value });
  }
  return rows.sort((a, b) => a.date.localeCompare(b.date));
}
function estimate(
  rows: readonly { date: string; value: number }[],
  metric: MetricField,
): SwingEstimate | null {
  if (rows.length < 5) return null;
  const values = rows.map((row) => (metric === 'overnightHrvMs' ? Math.log(row.value) : row.value));
  const center = median(values);
  const swing = median(values.map((value) => Math.abs(value - center))) * 1.4826;
  return swing > 0
    ? {
        value: swing,
        scale: metric === 'overnightHrvMs' ? 'log' : 'raw',
        sampleDates: rows.map((row) => row.date),
        sampleValues: rows.map((row) => row.value),
      }
    : null;
}
export function planBaseline(
  history: readonly HistoricalNight[],
  metric: MetricField,
  channel: DataChannel,
  requestedDate: string,
  assessedDate: string,
): BaselinePlan {
  assertDate(requestedDate);
  assertDate(assessedDate);
  if (assessedDate < requestedDate) throw new Error('Baseline assessment precedes request');
  // Only history available when watching was requested qualifies for the 28-night skip.
  const prior = usableHistory(history, metric, channel, requestedDate);
  const skipped = prior.length >= 28;
  const readyDate = skipped ? requestedDate : addDays(requestedDate, 7);
  const rows = skipped
    ? prior
    : usableHistory(history, metric, channel, assessedDate).filter(
        (row) => row.date > requestedDate,
      );
  const swing = estimate(rows, metric);
  return immutable({
    status: assessedDate < readyDate ? 'watching' : swing ? 'ready' : 'insufficient_data',
    skipped,
    requestedDate,
    readyDate,
    assessedDate,
    metric,
    channel,
    usableNights: rows.length,
    swing,
  });
}
