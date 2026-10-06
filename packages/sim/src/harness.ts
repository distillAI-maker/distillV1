import { deriveSeed } from './random.js';
import { runTrial } from './trial.js';
import type { TrialConfig } from './trial.js';

export interface Rate {
  readonly count: number;
  readonly trials: number;
  readonly value: number | null;
  readonly interval95: readonly [number, number] | null;
}
export function rate(count: number, trials: number): Rate {
  if (
    !Number.isInteger(trials) ||
    trials < 0 ||
    !Number.isInteger(count) ||
    count < 0 ||
    count > trials
  )
    throw new Error('Invalid binomial counts');
  if (!trials) return { count, trials, value: null, interval95: null };
  const p = count / trials,
    z = 1.959963984540054,
    denom = 1 + z ** 2 / trials;
  const center = (p + z ** 2 / (2 * trials)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / trials + z ** 2 / (4 * trials ** 2))) / denom;
  return {
    count,
    trials,
    value: p,
    interval95: [Math.max(0, center - half), Math.min(1, center + half)],
  };
}
export interface Scenario extends Omit<TrialConfig, 'seed' | 'effect'> {
  readonly id: string;
  readonly label: string;
}
export interface CellResult {
  readonly scenario: Scenario;
  readonly effect: number;
  readonly trials: number;
  readonly started: Rate;
  readonly decisive: Rate;
  readonly falsePositive: Rate | null;
  readonly wrongDirection: Rate | null;
  readonly intervalAvailable: Rate;
  readonly intervalCoverage: Rate;
  readonly reasons: Readonly<Record<string, number>>;
  readonly nullControl: 'supported' | 'uncertain' | 'failed' | 'not_a_null_cell';
}
export function simulateCell(
  scenario: Scenario,
  effect: number,
  trials: number,
  seed: number,
): CellResult {
  if (
    !Number.isInteger(trials) ||
    trials < 1 ||
    trials > 100000 ||
    !Number.isFinite(effect) ||
    Math.abs(effect) > 2
  )
    throw new Error('Invalid simulation size/effect');
  let started = 0,
    decisive = 0,
    wrong = 0,
    intervals = 0,
    covered = 0;
  const reasons: Record<string, number> = {};
  const scenarioSeed = deriveSeed(seed, scenario.id);
  for (let index = 0; index < trials; index++) {
    // Common random numbers across effect cells improve curve comparisons without choosing favorable seeds.
    const result = runTrial({
      ...scenario,
      effect,
      seed: deriveSeed(scenarioSeed, `trial:${index}`),
    });
    if (!result.analysis) {
      reasons.baseline_not_ready = (reasons.baseline_not_ready ?? 0) + 1;
      continue;
    }
    started++;
    const analysis = result.analysis;
    for (const reason of analysis.reasons) reasons[reason] = (reasons[reason] ?? 0) + 1;
    if (analysis.verdict !== 'Inconclusive') {
      decisive++;
      if (
        (effect > 0 && analysis.verdict === 'Dropped') ||
        (effect < 0 && analysis.verdict === 'Kept')
      )
        wrong++;
    }
    if (analysis.interval && result.clippedEffectMean !== null) {
      intervals++;
      if (
        analysis.interval.lower <= result.clippedEffectMean &&
        analysis.interval.upper >= result.clippedEffectMean
      )
        covered++;
    }
  }
  const falsePositive = effect === 0 ? rate(decisive, trials) : null;
  const nullControl = falsePositive?.interval95
    ? falsePositive.interval95[1] <= 0.05
      ? 'supported'
      : falsePositive.interval95[0] > 0.05
        ? 'failed'
        : 'uncertain'
    : 'not_a_null_cell';
  return {
    scenario,
    effect,
    trials,
    started: rate(started, trials),
    decisive: rate(decisive, trials),
    falsePositive,
    wrongDirection: effect === 0 ? null : rate(wrong, trials),
    intervalAvailable: rate(intervals, trials),
    intervalCoverage: rate(covered, intervals),
    reasons,
    nullControl,
  };
}
