import { immutable } from '../experiment/utils.js';
import { mean } from './math.js';

/**
 * Night-level effect estimate with an AR(1)-aware standard error and a literature prior.
 *
 * The question a person is asking is "how big is the effect on me, and which way?", not
 * "can a sharp null be rejected over the six schedules a 14-day block design allows". So the
 * unit of evidence is the night, the uncertainty accounts for nights near each other being
 * alike, and the answer is a posterior over the effect in units of the person's own swing.
 */
export interface NightSample {
  readonly sleepDate: string;
  /** Calendar offset of the night from the first scheduled night; gaps are allowed. */
  readonly dayIndex: number;
  readonly exposure: 'on' | 'off';
  /** Analysis-scale value: log for HRV, raw otherwise. */
  readonly value: number;
}
export interface EffectPrior {
  /** Standardized on-minus-off effect in the beneficial direction; positive means "helps". */
  readonly mean: number;
  readonly sd: number;
}
export interface EstimateInput {
  readonly samples: readonly NightSample[];
  /** Personal swing in analysis units; must be positive. */
  readonly swing: number;
  /** Lag-one autocorrelation between consecutive nights, 0 to 0.9. */
  readonly rho: number;
  readonly prior: EffectPrior;
  /** Beneficial direction of on minus off for this metric. */
  readonly direction: 'higher' | 'lower';
  /** Standard-error multiplier for observed (not assigned) exposure; 1 for randomized. */
  readonly inflation?: number;
  /** Observed exposure: compare within weekday and weekend nights, then combine. */
  readonly balanceWeekends?: boolean;
  /** The effect size counted as worthwhile, in swing units. */
  readonly worthwhile: number;
}
export interface EffectEstimateV2 {
  readonly nights: { readonly on: number; readonly off: number };
  /** on minus off in analysis units. */
  readonly difference: number;
  readonly standardError: number;
  /** Variance under AR(1) divided by the independent-nights variance. */
  readonly designEffect: number;
  /** Signed effect in swing units, positive when it helps. */
  readonly swingUnits: number;
  readonly swingUnitsSe: number;
  readonly prior: EffectPrior;
  readonly posterior: {
    readonly mean: number;
    readonly sd: number;
    readonly interval80: readonly [number, number];
  };
  readonly probabilities: {
    readonly helps: number;
    readonly hurts: number;
    readonly helpsWorthwhile: number;
    readonly hurtsWorthwhile: number;
    readonly smallerThanWorthwhile: number;
  };
  readonly worthwhile: number;
}

/** Abramowitz and Stegun 7.1.26; absolute error below 1.5e-7, which is far below any threshold used. */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) throw new Error('Finite z required');
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const poly =
    t *
    (0.254829592 +
      t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-x * x);
  return 0.5 * (1 + sign * erf);
}
const z80 = 1.2815515655446004;

const isWeekend = (sleepDate: string) => [0, 1].includes(new Date(`${sleepDate}T00:00:00Z`).getUTCDay());
/**
 * Contrast weights: the plain on-minus-off difference of means, or, for observed exposure, the
 * same difference taken inside weekday and weekend nights and combined by their size, so that a
 * habit that happens mostly at weekends is not credited with the weekend itself.
 */
export function contrastWeights(
  samples: readonly NightSample[],
  balanceWeekends: boolean,
): number[] {
  const on = samples.filter((s) => s.exposure === 'on');
  const off = samples.filter((s) => s.exposure === 'off');
  if (!on.length || !off.length) throw new Error('Both exposures are required');
  if (!balanceWeekends)
    return samples.map((s) => (s.exposure === 'on' ? 1 / on.length : -1 / off.length));
  const strata = [false, true].map((weekend) => {
    const members = samples.filter((s) => isWeekend(s.sleepDate) === weekend);
    const onCount = members.filter((s) => s.exposure === 'on').length;
    const offCount = members.length - onCount;
    return { weekend, size: members.length, onCount, offCount, usable: onCount > 0 && offCount > 0 };
  });
  const usable = strata.filter((stratum) => stratum.usable);
  if (!usable.length) return contrastWeights(samples, false);
  const total = usable.reduce((sum, stratum) => sum + stratum.size, 0);
  return samples.map((s) => {
    const stratum = strata.find((candidate) => candidate.weekend === isWeekend(s.sleepDate))!;
    if (!stratum.usable) return 0;
    const share = stratum.size / total;
    return s.exposure === 'on' ? share / stratum.onCount : -share / stratum.offCount;
  });
}
/** Variance of a contrast when nights follow AR(1) noise with correlation rho. */
export function contrastVariance(
  samples: readonly NightSample[],
  swing: number,
  rho: number,
  weights: readonly number[] = contrastWeights(samples, false),
): { readonly variance: number; readonly independentVariance: number } {
  const on = samples.filter((s) => s.exposure === 'on');
  const off = samples.filter((s) => s.exposure === 'off');
  if (!on.length || !off.length) throw new Error('Both exposures are required');
  if (weights.length !== samples.length) throw new Error('One weight per night');
  let variance = 0;
  for (let i = 0; i < samples.length; i++)
    for (let j = 0; j < samples.length; j++) {
      const lag = Math.abs(samples[i]!.dayIndex - samples[j]!.dayIndex);
      variance += weights[i]! * weights[j]! * Math.pow(rho, lag);
    }
  const independentVariance = 1 / on.length + 1 / off.length;
  return { variance: variance * swing ** 2, independentVariance: independentVariance * swing ** 2 };
}

export function estimateEffect(input: EstimateInput): EffectEstimateV2 {
  const { samples, swing, rho, prior, direction } = input;
  const inflation = input.inflation ?? 1;
  if (!Number.isFinite(swing) || swing <= 0) throw new Error('Positive swing required');
  if (!Number.isFinite(rho) || rho < 0 || rho > 0.9) throw new Error('rho must be in [0, 0.9]');
  if (!Number.isFinite(prior.mean) || !Number.isFinite(prior.sd) || prior.sd <= 0)
    throw new Error('Invalid prior');
  if (!Number.isFinite(inflation) || inflation < 1) throw new Error('Inflation must be at least 1');
  if (!Number.isFinite(input.worthwhile) || input.worthwhile <= 0)
    throw new Error('Worthwhile effect must be positive');
  if (!['higher', 'lower'].includes(direction)) throw new Error('Invalid direction');
  const dates = new Set<string>();
  for (const s of samples) {
    if (
      !Number.isInteger(s.dayIndex) ||
      s.dayIndex < 0 ||
      !Number.isFinite(s.value) ||
      !['on', 'off'].includes(s.exposure) ||
      dates.has(s.sleepDate)
    )
      throw new Error('Invalid night sample');
    dates.add(s.sleepDate);
  }
  const on = samples.filter((s) => s.exposure === 'on').map((s) => s.value);
  const off = samples.filter((s) => s.exposure === 'off').map((s) => s.value);
  const weights = contrastWeights(samples, input.balanceWeekends ?? false);
  const difference = samples.reduce((sum, s, i) => sum + weights[i]! * s.value, 0);
  const { variance, independentVariance } = contrastVariance(samples, swing, rho, weights);
  const standardError = Math.sqrt(variance) * inflation;
  const sign = direction === 'higher' ? 1 : -1;
  const swingUnits = (sign * difference) / swing;
  const swingUnitsSe = standardError / swing;
  // Normal prior, normal likelihood: precision-weighted posterior on the standardized effect.
  const dataPrecision = 1 / swingUnitsSe ** 2;
  const priorPrecision = 1 / prior.sd ** 2;
  const posteriorSd = Math.sqrt(1 / (dataPrecision + priorPrecision));
  const posteriorMean =
    (prior.mean * priorPrecision + swingUnits * dataPrecision) / (dataPrecision + priorPrecision);
  const p = (threshold: number, above: boolean) => {
    const z = (threshold - posteriorMean) / posteriorSd;
    return above ? 1 - normalCdf(z) : normalCdf(z);
  };
  const w = input.worthwhile;
  return immutable({
    nights: { on: on.length, off: off.length },
    difference,
    standardError,
    designEffect: variance / independentVariance,
    swingUnits,
    swingUnitsSe,
    prior: { mean: prior.mean, sd: prior.sd },
    posterior: {
      mean: posteriorMean,
      sd: posteriorSd,
      interval80: [posteriorMean - z80 * posteriorSd, posteriorMean + z80 * posteriorSd],
    },
    probabilities: {
      helps: p(0, true),
      hurts: p(0, false),
      helpsWorthwhile: p(w, true),
      hurtsWorthwhile: p(-w, false),
      smallerThanWorthwhile: p(w, false) - p(-w, false),
    },
    worthwhile: w,
  });
}

/**
 * Lag-one autocorrelation of a person's own nights, shrunk toward a default so that a short
 * baseline cannot produce an extreme value. Only consecutive calendar nights contribute.
 */
export function estimateRho(
  rows: readonly { readonly date: string; readonly value: number }[],
  options: { readonly defaultRho: number; readonly priorWeight: number; readonly max: number },
): { readonly value: number; readonly basis: 'estimated' | 'default'; readonly pairs: number } {
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  if (sorted.some((row) => !Number.isFinite(row.value))) throw new Error('Finite values required');
  const values = sorted.map((row) => row.value);
  const center = values.length ? mean(values) : 0;
  let numerator = 0,
    pairs = 0;
  for (let i = 1; i < sorted.length; i++) {
    const previous = new Date(`${sorted[i - 1]!.date}T00:00:00Z`).getTime();
    const current = new Date(`${sorted[i]!.date}T00:00:00Z`).getTime();
    if (current - previous !== 86400000) continue;
    numerator += (values[i]! - center) * (values[i - 1]! - center);
    pairs++;
  }
  const denominator = values.reduce((sum, value) => sum + (value - center) ** 2, 0);
  if (pairs < 5 || denominator <= 0)
    return immutable({ value: options.defaultRho, basis: 'default', pairs });
  const raw = numerator / denominator;
  const shrunk = (pairs * raw + options.priorWeight * options.defaultRho) / (pairs + options.priorWeight);
  return immutable({
    value: Math.min(options.max, Math.max(0, shrunk)),
    basis: 'estimated',
    pairs,
  });
}
