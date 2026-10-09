import {
  planBaseline,
  recordCheckIn,
  startExperiment,
  createSchedule,
} from '@distill/engine/experiment';
import { routeStack } from '@distill/engine';
import { analyzeExperiment } from '@distill/engine/stats';
import type { AnalysisResult } from '@distill/engine/stats';
import type { MetricField, ScheduleConfig, TestPolicy } from '@distill/engine/experiment';
import { addDays } from '../../engine/src/experiment/utils.js';
import { generatePerson } from './generator.js';
import type { GeneratorConfig } from './generator.js';
import { deriveSeed } from './random.js';
import { metricModels } from './model.js';

export interface TrialConfig {
  readonly seed: number;
  readonly effect: number;
  readonly metric?: MetricField;
  readonly schedule: ScheduleConfig;
  readonly baselineDays?: number;
  readonly rho?: number;
  readonly missedTapRate?: number;
  readonly illnessRate?: number;
  readonly missingMetricRate?: number;
  readonly deviceNoiseFraction?: number;
  readonly weekendSwing?: number;
  readonly testPolicy?: TestPolicy;
  readonly missingness?: GeneratorConfig['missingness'];
  readonly carryoverDays?: number;
  readonly carryoverFraction?: number;
  readonly bootstrapIterations?: number;
  readonly withInterval?: boolean;
}
export interface TrialResult {
  readonly analysis: AnalysisResult | null;
  readonly failure: 'baseline_not_ready' | null;
  readonly clippedEffectMean: number | null;
  readonly nominalAnalysisEffect: number;
}
const candidate = routeStack([{ id: 'sim-variable', key: 'coffee-after-2pm' }], {
  'sim-variable': { goal: 'sleep', time: '2 to 5pm' },
}).runnable[0]!;
export function runTrial(config: TrialConfig): TrialResult {
  const metric = config.metric ?? 'totalSleepMinutes';
  const baselineDays = config.baselineDays ?? 28;
  if (!Number.isInteger(baselineDays) || baselineDays < 7 || baselineDays > 365)
    throw new Error('Baseline must contain 7–365 calendar days');
  const startDate = '2026-10-05';
  const scheduleSeed = deriveSeed(config.seed, 'schedule');
  const schedule = createSchedule(startDate, scheduleSeed, false, config.schedule);
  const from = addDays(startDate, 1 - baselineDays),
    to = addDays(schedule.days.at(-1)!.sleepDate, 1);
  const direction = [
    'sleepLatencyMinutes',
    'wakeAfterSleepOnsetMinutes',
    'restingHeartRateBpm',
    'breathingRatePerMinute',
    'skinTemperatureDeviationC',
  ].includes(metric)
    ? 'lower'
    : 'higher';
  const person = generatePerson({
    ...config,
    metrics: [metric],
    seed: deriveSeed(config.seed, 'person-series'),
    personId: 'simulation',
    from,
    to,
    effect: {
      metric,
      direction,
      swingUnits: config.effect,
      onDates: schedule.days.filter((day) => day.condition === 'on').map((day) => day.sleepDate),
      carryoverDays: config.carryoverDays,
      carryoverFraction: config.carryoverFraction,
    },
  });
  const channel = {
    source: 'synthetic' as const,
    deviceModel: 'Distill synthetic v1',
    ...(metric === 'overnightHrvMs' ? { hrvMethod: 'rmssd' as const } : {}),
  };
  const baseline = planBaseline(
    person.history,
    metric,
    channel,
    addDays(startDate, -baselineDays),
    startDate,
  );
  const nominalAnalysisEffect =
    config.effect * person.models[metric].swing * (direction === 'higher' ? 1 : -1);
  if (baseline.status !== 'ready')
    return {
      analysis: null,
      failure: 'baseline_not_ready',
      clippedEffectMean: null,
      nominalAnalysisEffect,
    };
  const registration = startExperiment({
    experimentId: '40000000-0000-4000-8000-000000000001',
    cycleId: '50000000-0000-4000-8000-000000000001',
    // A declared simulation outcome, not a changed real-user routing recommendation.
    candidate: { ...candidate, metric: metricModels[metric].name },
    baseline,
    lockedAt: `${startDate}T12:00:00Z`,
    timeZone: 'UTC',
    direction,
    onDefinition: 'Synthetic exposure present',
    offDefinition: 'Synthetic exposure absent',
    seed: scheduleSeed,
    config: config.schedule,
    testPolicy: config.testPolicy ?? 'both_directions',
    decisionPolicy: 'legacy',
  });
  const checkIns = schedule.days.map((day) => {
    const generated = person.days.find((entry) => entry.sleepDate === day.sleepDate)!;
    return recordCheckIn(registration, {
      sleepDate: day.sleepDate,
      tap: generated.missedTap ? undefined : 'did',
      exclusions: generated.ill ? ['ill'] : [],
    });
  });
  const analysis = analyzeExperiment({
    registration,
    nights: person.history,
    checkIns,
    through: schedule.days.at(-1)!.sleepDate,
    bootstrap: {
      enabled: config.withInterval ?? false,
      iterations: config.bootstrapIterations ?? 1000,
    },
  });
  const changes = schedule.days
    .filter((day) => !analysis.excluded.some((entry) => entry.sleepDate === day.sleepDate))
    .flatMap((day) => {
      const generated = person.days.find((entry) => entry.sleepDate === day.sleepDate)!;
      return generated.noTreatmentValue !== null && generated.treatedValue !== null
        ? [generated.treatedValue - generated.noTreatmentValue]
        : [];
    });
  return {
    analysis,
    failure: null,
    nominalAnalysisEffect,
    clippedEffectMean: changes.length
      ? changes.reduce((sum, value) => sum + value, 0) / changes.length
      : null,
  };
}
