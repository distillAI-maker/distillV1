import type { CheckIn, HistoricalNight, PreRegistration, TestPolicy } from '../experiment/types.js';
import type { BootstrapInterval } from './bootstrap.js';
import type { RandomizationResult } from './randomization.js';

export type Verdict = 'Kept' | 'Dropped' | 'Inconclusive';
export type InconclusiveReason =
  | 'experiment_not_finished'
  | 'insufficient_nights'
  | 'observational_design'
  | 'noncompliance'
  | 'baseline_unavailable'
  | 'zero_personal_swing'
  | 'assignment_resolution'
  | 'randomization_not_estimable'
  | 'opposite_direction_not_tested'
  | 'effect_direction_disagreement'
  | 'no_difference'
  | 'not_significant';
export type ExclusionReason =
  'not_yet_observed' | 'carryover' | 'flagged' | 'unknown_exposure' | 'measurement_unavailable';
export interface AnalysisInput {
  readonly registration: PreRegistration;
  /** May contain baseline and unrelated nights; only the saved channel/date range is used. */
  readonly nights: readonly HistoricalNight[];
  readonly checkIns: readonly CheckIn[];
  /** Local wake-date cutoff; the caller derives this from the authenticated person's timezone. */
  readonly through: string;
  readonly bootstrap?: {
    readonly seed?: number;
    readonly iterations?: number;
    readonly enabled?: boolean;
  };
}
export interface EffectEstimate {
  readonly onMean: number;
  readonly offMean: number;
  readonly difference: number;
  readonly transformedDifference: number;
  readonly swingUnits: number | null;
}
export interface AnalysisSwing {
  readonly value: number;
  readonly scale: 'raw' | 'log';
  readonly baselineNights: number;
  readonly offNights: number;
  readonly baselineSource: 'locked_snapshot' | 'legacy_history_verified';
}
export interface AnalysisResult {
  readonly version: 1;
  readonly experimentId: string;
  readonly itemId: string;
  readonly itemKey: string;
  readonly unverified: boolean;
  readonly metricName: string;
  readonly metric: PreRegistration['metric'];
  readonly direction: PreRegistration['direction'];
  readonly onDefinition: string;
  readonly offDefinition: string;
  readonly design: PreRegistration['schedule']['design'];
  readonly testPolicy: TestPolicy;
  readonly through: string;
  readonly alpha: number;
  readonly perTailAlpha: number;
  readonly verdict: Verdict;
  readonly reasons: readonly InconclusiveReason[];
  readonly validNights: { readonly on: number; readonly off: number };
  readonly excluded: readonly { readonly sleepDate: string; readonly reason: ExclusionReason }[];
  readonly noncompliantDates: readonly string[];
  readonly effect: EffectEstimate | null;
  readonly personalSwing: AnalysisSwing | null;
  readonly lockedSwing: PreRegistration['personalSwing'];
  /** Internal diagnostics, never serialized directly into a result card. */
  readonly randomization: RandomizationResult | null;
  readonly interval: BootstrapInterval | null;
  readonly validation: 'simulation_evidence_available';
  readonly limitations: readonly string[];
}
