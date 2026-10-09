import { planBaseline, recordCheckIn, startExperiment, createSchedule } from '@distill/engine/experiment';
import { routeStack } from '@distill/engine';
import { analyzeExperiment, estimateV2 } from '@distill/engine/stats';
import type { AnalysisResult, DecisionPolicy, Outcome } from '@distill/engine/stats';
import type { MetricField, ScheduleConfig } from '@distill/engine/experiment';
import { addDays } from '../../engine/src/experiment/utils.js';
import { generatePerson } from './generator.js';
import type { GeneratorConfig } from './generator.js';
import { rate } from './harness.js';
import type { Rate } from './harness.js';
import { metricModels } from './model.js';
import { deriveSeed, Random } from './random.js';

/**
 * Measures the estimate-based decision policy the way the app runs it: a 28-day schedule read at
 * days 14, 21 and 28, stopping at the first decisive look. Everything below uses the real engine.
 */
export interface DecisionTrialConfig {
  readonly seed: number;
  /** Injected effect in swing units; positive helps, negative hurts. */
  readonly effect: number;
  readonly metric?: MetricField;
  readonly policy?: DecisionPolicy;
  readonly baselineDays?: number;
  readonly rho?: number;
  readonly missedTapRate?: number;
  /** Share of assigned nights the person does the opposite of the instruction. */
  readonly didntRate?: number;
  readonly illnessRate?: number;
  readonly missingMetricRate?: number;
  readonly deviceNoiseFraction?: number;
  readonly weekendSwing?: number;
  readonly missingness?: GeneratorConfig['missingness'];
  /** Observed exposure (alcohol-style) instead of assigned on/off days. */
  readonly observed?: boolean;
  /** Which catalogue prior the registration sees: the row's own, or a neutral one. */
  readonly prior?: 'catalog' | 'flat' | 'opposed';
}
export interface DecisionTrialResult {
  readonly analysis: AnalysisResult | null;
  readonly failure: 'baseline_not_ready' | null;
  readonly outcome: Outcome | null;
  readonly decidedAtDay: number | null;
}
const assigned = routeStack([{ id: 'sim-variable', key: 'coffee-after-2pm' }], {
  'sim-variable': { goal: 'sleep', time: '2 to 5pm' },
}).runnable[0]!;
const observedCandidate = routeStack([{ id: 'sim-observed', key: 'alcohol-in-the-evening' }], {
  'sim-observed': { goal: 'sleep', nightsPerWeek: 4 },
}).runnable[0]!;

export function runDecisionTrial(config: DecisionTrialConfig): DecisionTrialResult {
  const metric = config.metric ?? 'totalSleepMinutes';
  const policy = config.policy ?? estimateV2;
  const baselineDays = config.baselineDays ?? 28;
  const startDate = '2026-10-05';
  const scheduleSeed = deriveSeed(config.seed, 'schedule');
  const scheduleConfig: ScheduleConfig = {
    totalDays: policy.looks.at(-1)!,
    minimumNightsPerSide: policy.minimumNightsPerSide,
    dropFirstNightOfBlock: false,
    balancedPrefixDays: [policy.looks[0]!],
  };
  const schedule = createSchedule(startDate, scheduleSeed, !!config.observed, scheduleConfig);
  const behaviour = new Random(deriveSeed(config.seed, 'behaviour'));
  // Actual exposure per night: the assignment, flipped on the nights the person did the opposite.
  const flipped = new Set<string>();
  for (const day of schedule.days)
    if (!config.observed && behaviour.uniform() < (config.didntRate ?? 0)) flipped.add(day.sleepDate);
  const actualOn = new Set(
    schedule.days
      .filter((day) =>
        config.observed
          ? day.condition === 'observe'
          : (day.condition === 'on') !== flipped.has(day.sleepDate),
      )
      .map((day) => day.sleepDate),
  );
  const direction = [
    'sleepLatencyMinutes',
    'wakeAfterSleepOnsetMinutes',
    'restingHeartRateBpm',
    'breathingRatePerMinute',
    'skinTemperatureDeviationC',
  ].includes(metric)
    ? 'lower'
    : 'higher';
  const from = addDays(startDate, 1 - baselineDays),
    to = addDays(schedule.days.at(-1)!.sleepDate, 1);
  const person = generatePerson({
    seed: deriveSeed(config.seed, 'person-series'),
    personId: 'decision-simulation',
    from,
    to,
    metrics: [metric],
    rho: config.rho,
    missedTapRate: config.missedTapRate,
    illnessRate: config.illnessRate,
    missingMetricRate: config.missingMetricRate,
    deviceNoiseFraction: config.deviceNoiseFraction,
    weekendSwing: config.weekendSwing,
    missingness: config.missingness,
    effect: {
      metric,
      // The generator injects the effect in its own direction; a negative effect size hurts.
      direction: config.effect >= 0 ? direction : direction === 'higher' ? 'lower' : 'higher',
      swingUnits: Math.abs(config.effect),
      onDates: [...actualOn],
    },
  });
  const channel = {
    source: 'synthetic' as const,
    deviceModel: 'Distill synthetic v1',
    ...(metric === 'overnightHrvMs' ? { hrvMethod: 'rmssd' as const } : {}),
  };
  const baseline = planBaseline(person.history, metric, channel, addDays(startDate, -baselineDays), startDate);
  if (baseline.status !== 'ready')
    return { analysis: null, failure: 'baseline_not_ready', outcome: null, decidedAtDay: null };
  const base = config.observed ? observedCandidate : assigned;
  const candidate = {
    ...base,
    metric: metricModels[metric].name,
    ...(config.prior === 'flat'
      ? { directionText: null }
      : config.prior === 'opposed'
        ? { directionText: 'better' }
        : {}),
  };
  const registration = startExperiment({
    experimentId: '40000000-0000-4000-8000-000000000002',
    cycleId: '50000000-0000-4000-8000-000000000002',
    candidate,
    baseline,
    lockedAt: `${startDate}T12:00:00Z`,
    timeZone: 'UTC',
    direction,
    onDefinition: 'Synthetic exposure present',
    offDefinition: 'Synthetic exposure absent',
    seed: scheduleSeed,
    decisionPolicy: policy,
  });
  const checkIns = registration.schedule.days.map((day) => {
    const generated = person.days.find((entry) => entry.sleepDate === day.sleepDate)!;
    const exclusions = generated.ill ? (['ill'] as const) : [];
    if (generated.missedTap) return recordCheckIn(registration, { sleepDate: day.sleepDate, exclusions });
    if (config.observed)
      return recordCheckIn(registration, {
        sleepDate: day.sleepDate,
        exposure: actualOn.has(day.sleepDate) ? 'on' : 'off',
        exclusions,
      });
    return recordCheckIn(registration, {
      sleepDate: day.sleepDate,
      tap: flipped.has(day.sleepDate) ? 'didnt' : 'did',
      exclusions,
    });
  });
  let analysis: AnalysisResult | null = null;
  for (const [index, look] of registration.decision!.looks.entries()) {
    analysis = analyzeExperiment({
      registration,
      nights: person.history,
      checkIns,
      through: look,
      bootstrap: { enabled: false },
    });
    if (analysis.verdict !== 'Inconclusive' || analysis.look?.complete)
      return { analysis, failure: null, outcome: analysis.outcome, decidedAtDay: policy.looks[index]! };
  }
  return { analysis, failure: null, outcome: analysis?.outcome ?? null, decidedAtDay: null };
}

export interface DecisionScenario extends Omit<DecisionTrialConfig, 'seed' | 'effect'> {
  readonly id: string;
  readonly label: string;
}
export interface DecisionCell {
  readonly scenario: DecisionScenario;
  readonly effect: number;
  readonly trials: number;
  readonly outcomes: Readonly<Record<Outcome | 'baseline_not_ready', number>>;
  /** Kept or "costs you" when the true effect is zero. */
  readonly falsePositive: Rate | null;
  /** Kept or "costs you" in the true direction, for a nonzero effect. */
  readonly power: Rate | null;
  readonly wrongDirection: Rate | null;
  /** "Does nothing" when the true effect is at least 0.8 swings: a real miss. */
  readonly missedAsNothing: Rate | null;
  /** "Does nothing" when the true effect is zero: the correct call for a paid item. */
  readonly correctNothing: Rate | null;
  readonly decidedByDay: Readonly<Record<string, number>>;
  readonly meanDays: number | null;
}
export function simulateDecisionCell(
  scenario: DecisionScenario,
  effect: number,
  trials: number,
  seed: number,
): DecisionCell {
  if (!Number.isInteger(trials) || trials < 1 || trials > 100000 || !Number.isFinite(effect))
    throw new Error('Invalid simulation size/effect');
  const outcomes: Record<Outcome | 'baseline_not_ready', number> = {
    helps: 0,
    costs_you: 0,
    no_detectable_benefit: 0,
    too_close_extend: 0,
    too_close_final: 0,
    not_enough_nights: 0,
    in_progress: 0,
    baseline_not_ready: 0,
  };
  const decidedByDay: Record<string, number> = {};
  let decisive = 0,
    correct = 0,
    wrong = 0,
    nothing = 0,
    daysTotal = 0,
    daysCount = 0;
  const scenarioSeed = deriveSeed(seed, scenario.id);
  for (let index = 0; index < trials; index++) {
    const result = runDecisionTrial({
      ...scenario,
      effect,
      seed: deriveSeed(scenarioSeed, `trial:${index}`),
    });
    if (!result.analysis) {
      outcomes.baseline_not_ready++;
      continue;
    }
    const outcome = result.outcome ?? 'in_progress';
    outcomes[outcome]++;
    if (result.decidedAtDay !== null) {
      decidedByDay[result.decidedAtDay] = (decidedByDay[result.decidedAtDay] ?? 0) + 1;
      daysTotal += result.decidedAtDay;
      daysCount++;
    }
    if (outcome === 'helps' || outcome === 'costs_you') {
      decisive++;
      const truthHelps = effect > 0,
        truthHurts = effect < 0;
      if ((outcome === 'helps' && truthHelps) || (outcome === 'costs_you' && truthHurts)) correct++;
      else if (effect !== 0) wrong++;
    }
    if (outcome === 'no_detectable_benefit') nothing++;
  }
  return {
    scenario,
    effect,
    trials,
    outcomes,
    falsePositive: effect === 0 ? rate(decisive, trials) : null,
    power: effect !== 0 ? rate(correct, trials) : null,
    wrongDirection: effect !== 0 ? rate(wrong, trials) : null,
    missedAsNothing: Math.abs(effect) >= 0.8 ? rate(nothing, trials) : null,
    correctNothing: effect === 0 ? rate(nothing, trials) : null,
    decidedByDay,
    meanDays: daysCount ? daysTotal / daysCount : null,
  };
}
const base = {
  baselineDays: 28,
  rho: 0.35,
  missedTapRate: 0.1,
  illnessRate: 0.02,
  missingMetricRate: 0.02,
  deviceNoiseFraction: 0.1,
  weekendSwing: 0.25,
};
export const decisionScenarios: readonly DecisionScenario[] = [
  { ...base, id: 'v2-reference', label: 'Reference: rho 0.35, 10% missed taps, row prior' },
  { ...base, id: 'v2-flat-prior', label: 'Neutral prior', prior: 'flat' },
  { ...base, id: 'v2-opposed-prior', label: 'Prior points the wrong way', prior: 'opposed' },
  { ...base, id: 'v2-rho-0', label: 'Independent nights (rho 0)', rho: 0 },
  { ...base, id: 'v2-rho-0.7', label: 'Highly correlated nights (rho 0.7)', rho: 0.7 },
  { ...base, id: 'v2-didnt-15', label: '15% of nights done the opposite way', didntRate: 0.15 },
  { ...base, id: 'v2-missed-25', label: '25% missed taps', missedTapRate: 0.25 },
  { ...base, id: 'v2-baseline-7', label: '7-night baseline', baselineDays: 7 },
  { ...base, id: 'v2-observed', label: 'Observed exposure (alcohol-style)', observed: true },
  { ...base, id: 'v2-hrv', label: 'Overnight HRV', metric: 'overnightHrvMs' },
  { ...base, id: 'v2-latency', label: 'Time to fall asleep', metric: 'sleepLatencyMinutes' },
  {
    ...base,
    id: 'v2-omit-bad-on-nights',
    label: 'INVALID: omit bad on-nights',
    missingness: 'outcome_assignment_dependent',
  },
];
export const decisionEffects = [-1.2, -0.8, -0.5, 0, 0.5, 0.8, 1.2] as const;
