import type { MetricUnit } from '../stats/presentation.js';
import type { MetricField } from '../experiment/types.js';

export type DisplayUnit = MetricUnit | 'percent';
const metricUnits: Record<MetricField, MetricUnit> = {
  totalSleepMinutes: 'minutes',
  sleepLatencyMinutes: 'minutes',
  deepSleepMinutes: 'minutes',
  remSleepMinutes: 'minutes',
  wakeAfterSleepOnsetMinutes: 'minutes',
  sleepEfficiencyPercent: 'percentage_points',
  overnightHrvMs: 'ms',
  restingHeartRateBpm: 'bpm',
  breathingRatePerMinute: 'breaths_per_minute',
  skinTemperatureDeviationC: 'celsius',
};
export function metricUnit(metric: MetricField): MetricUnit {
  if (!Object.hasOwn(metricUnits, metric)) throw new Error('Unknown outcome metric');
  return metricUnits[metric];
}
const increments: Record<DisplayUnit, number> = {
  minutes: 1,
  ms: 1,
  bpm: 0.5,
  breaths_per_minute: 0.1,
  percentage_points: 0.1,
  celsius: 0.1,
  percent: 0.1,
};
const labels: Record<DisplayUnit, readonly [string, string]> = {
  minutes: ['minute', 'minutes'],
  ms: ['ms', 'ms'],
  bpm: ['bpm', 'bpm'],
  breaths_per_minute: ['breath/min', 'breaths/min'],
  percentage_points: ['percentage point', 'percentage points'],
  celsius: ['°C', '°C'],
  percent: ['%', '%'],
};
export function finite(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value))
    throw new Error('Expected a finite number');
  return value;
}
export function roundMeasurement(value: number, unit: DisplayUnit): number {
  finite(value);
  const step = increments[unit];
  if (!step) throw new Error('Unknown measurement unit');
  const rounded =
    Math.sign(value) *
    Math.round((Math.abs(value) + Number.EPSILON * Math.max(1, Math.abs(value))) / step) *
    step;
  return Object.is(rounded, -0) ? 0 : Number(rounded.toFixed(step === 1 ? 0 : 1));
}
export function formatNumber(value: number): string {
  finite(value);
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value);
}
export function formatMeasurement(value: number, unit: DisplayUnit): string {
  const rounded = roundMeasurement(value, unit),
    label = labels[unit][Math.abs(rounded) === 1 ? 0 : 1];
  return `${formatNumber(rounded)}${unit === 'percent' ? '' : ' '}${label}`;
}
export function formatChange(value: number, unit: DisplayUnit): string {
  finite(value);
  const amount = Math.abs(value);
  if (amount > 0 && roundMeasurement(amount, unit) === 0)
    return `less than ${formatMeasurement(increments[unit], unit)}`;
  return formatMeasurement(amount, unit);
}
export function formatMoney(value: number): string {
  if (finite(value) < 0) throw new Error('Cost cannot be negative');
  return `$${new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Math.round((value + Number.EPSILON) * 100) / 100)}`;
}
export function formatCount(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0)
    throw new Error('Expected a nonnegative whole count');
  return formatNumber(value);
}
export function formatDose(value: number, unit: string): string {
  if (finite(value) < 0 || !['mg', 'g', 'ml', 'IU', 'mg elemental', 'mg EPA+DHA'].includes(unit))
    throw new Error('Invalid dose or dose unit');
  return `${new Intl.NumberFormat('en-US', { maximumSignificantDigits: 15 }).format(value)} ${unit}`;
}
