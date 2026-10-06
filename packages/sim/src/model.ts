import type { MetricField } from '@distill/engine/experiment';
import catalog from '../../../data/catalog.json' with { type: 'json' };
import { Random } from './random.js';

export interface MetricModel {
  readonly name: string;
  readonly mean: number;
  /** Marginal SD in analysis space (log HRV, raw otherwise); source estimates are model assumptions. */
  readonly swing: number;
  readonly lower: number;
  readonly upper: number;
  readonly sourceRow: number;
  readonly sourceSwingText: string;
}
const settings: Record<MetricField, readonly [string, number, number, number, number]> = {
  totalSleepMinutes: ['Total sleep', 420, 45, 120, 720],
  sleepLatencyMinutes: ['Time to fall asleep', 22, 10, 0, 120],
  deepSleepMinutes: ['Deep sleep', 70, 15, 0, 240],
  remSleepMinutes: ['REM sleep', 95, 15, 0, 300],
  wakeAfterSleepOnsetMinutes: ['Time awake during the night', 30, 12, 0, 180],
  sleepEfficiencyPercent: ['Share of time in bed asleep', 88, 4, 30, 100],
  overnightHrvMs: ['Overnight HRV', 60, Math.sqrt(Math.log(1 + 0.2 ** 2)), 5, 250],
  restingHeartRateBpm: ['Resting heart rate', 56, 2.5, 35, 110],
  breathingRatePerMinute: ['Breathing rate', 15, 0.5, 8, 30],
  skinTemperatureDeviationC: ['Skin temperature', 0, 0.25, -3, 3],
};
export const metricModels = Object.freeze(
  Object.fromEntries(
    Object.entries(settings).map(([field, values]) => {
      const [name, mean, swing, lower, upper] = values;
      const source = catalog.metrics.find((metric) => metric.name === name)!;
      if (!source) throw new Error(`Missing metric source: ${name}`);
      return [
        field,
        Object.freeze({
          name,
          mean,
          swing,
          lower,
          upper,
          sourceRow: source.source.row,
          sourceSwingText: source.personalSwingText,
        }),
      ];
    }),
  ),
) as Readonly<Record<MetricField, MetricModel>>;
export function personModels(seed: number): Readonly<Record<MetricField, MetricModel>> {
  const random = new Random(seed);
  return Object.fromEntries(
    Object.entries(metricModels).map(([field, model]) => [
      field,
      {
        ...model,
        mean:
          field === 'overnightHrvMs'
            ? model.mean * Math.exp(0.18 * random.normal())
            : model.mean + model.swing * 0.3 * random.normal(),
        swing: model.swing * Math.exp(0.12 * random.normal()),
      },
    ]),
  ) as Record<MetricField, MetricModel>;
}
export function observedValue(
  field: MetricField,
  analysisValue: number,
  model: MetricModel,
): number {
  const raw = field === 'overnightHrvMs' ? Math.exp(analysisValue) : analysisValue;
  return Math.min(model.upper, Math.max(model.lower, raw));
}
