import type { MetricField } from '../experiment/types.js';
import { immutable } from '../experiment/utils.js';
import type { AnalysisResult, InconclusiveReason, Verdict } from './types.js';
import type { Outcome } from './policy.js';

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
  /** The change as a percentage of the off-nights, for metrics read on a log scale (HRV); null otherwise. */
  readonly percentChange: number | null;
  readonly interval: { readonly level: 0.9; readonly lower: number; readonly upper: number } | null;
  /** Estimate-based decision; null for legacy registrations. */
  readonly outcome: Outcome | null;
  readonly chance: {
    /** Posterior probability the item helps, 0 to 1. */
    readonly helps: number;
    readonly hurts: number;
    readonly worthwhileBenefit: number;
  } | null;
  /** 80% range for the change, in the card's unit (percent for HRV). */
  readonly likelyRange: { readonly lower: number; readonly upper: number; readonly unit: MetricUnit | 'percent' } | null;
  readonly look: AnalysisResult['look'];
  readonly deviationShare: number | null;
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
    percentChange:
      result.effect && result.personalSwing?.scale === 'log'
        ? 100 * Math.expm1(result.effect.transformedDifference)
        : null,
    // Phase 6 evaluates the internal interval; nominal 90% coverage is not established.
    interval: null,
    intervalStatus: result.interval ? 'coverage_not_established' : 'not_available',
    outcome: result.outcome,
    chance: result.estimate
      ? {
          helps: result.estimate.probabilities.helps,
          hurts: result.estimate.probabilities.hurts,
          worthwhileBenefit: result.estimate.probabilities.helpsWorthwhile,
        }
      : null,
    likelyRange: likelyRange(result),
    look: result.look,
    deviationShare: result.deviationShare,
  });
}
/** The posterior 80% range for on minus off, back in the unit the person sees. */
function likelyRange(result: AnalysisResult): ExperimentResultCard['likelyRange'] {
  const estimate = result.estimate,
    swing = result.personalSwing;
  if (!estimate || !swing || swing.value <= 0) return null;
  const sign = result.direction === 'higher' ? 1 : -1;
  // Posterior is in beneficial swing units; convert to on-minus-off analysis units.
  const bounds = estimate.posterior.interval80.map((value) => sign * value * swing.value);
  const [low, high] = [Math.min(...bounds), Math.max(...bounds)];
  if (swing.scale === 'log')
    return { lower: 100 * Math.expm1(low), upper: 100 * Math.expm1(high), unit: 'percent' };
  return { lower: low, upper: high, unit: units[result.metric] };
}
