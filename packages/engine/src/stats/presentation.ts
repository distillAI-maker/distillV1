import type { MetricField } from '../experiment/types.js';
import { immutable } from '../experiment/utils.js';
import type { AnalysisResult, InconclusiveReason, Verdict } from './types.js';

export type MetricUnit =
  'minutes' | 'ms' | 'bpm' | 'breaths_per_minute' | 'percentage_points' | 'celsius';
const units: Record<MetricField, MetricUnit> = {
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
export interface ExperimentResultCard {
  readonly experimentId: string;
  readonly itemId: string;
  readonly unverified: boolean;
  readonly metricName: string;
  readonly unit: MetricUnit;
  readonly word: Verdict;
  readonly reasons: readonly InconclusiveReason[];
  readonly evidence: 'randomized' | 'observational';
  readonly validation: AnalysisResult['validation'];
  readonly intervalStatus: 'coverage_not_established' | 'not_available';
  readonly onCondition: string;
  readonly offCondition: string;
  readonly nights: { readonly on: number; readonly off: number };
  readonly number: { readonly on: number; readonly off: number; readonly change: number } | null;
  readonly swing: { readonly value: number; readonly unit: MetricUnit | 'percent' } | null;
  readonly changeInSwingUnits: number | null;
  readonly interval: { readonly level: 0.9; readonly lower: number; readonly upper: number } | null;
}
/** Explicit allowlist: internal p-values, alpha, seeds and test diagnostics never enter the UI payload. */
export function experimentResultCard(result: AnalysisResult): ExperimentResultCard {
  return immutable({
    experimentId: result.experimentId,
    itemId: result.itemId,
    unverified: result.unverified,
    metricName: result.metricName,
    unit: units[result.metric],
    word: result.verdict,
    reasons: result.reasons,
    evidence: result.design,
    validation: result.validation,
    onCondition: result.onDefinition,
    offCondition: result.offDefinition,
    nights: result.validNights,
    number: result.effect
      ? { on: result.effect.onMean, off: result.effect.offMean, change: result.effect.difference }
      : null,
    swing: result.personalSwing
      ? {
          value:
            result.personalSwing.scale === 'log'
              ? 100 * Math.expm1(result.personalSwing.value)
              : result.personalSwing.value,
          unit: result.personalSwing.scale === 'log' ? 'percent' : units[result.metric],
        }
      : null,
    changeInSwingUnits: result.effect?.swingUnits ?? null,
    // Phase 6 evaluates the internal interval; nominal 90% coverage is not established.
    interval: null,
    intervalStatus: result.interval ? 'coverage_not_established' : 'not_available',
  });
}
