import type { Scenario } from './harness.js';
import type { MetricField } from '@distill/engine/experiment';
export const effectGrid = [0, 0.2, 0.4, 0.6, 0.8, 1, 1.2, 1.6, 2] as const;
const base = {
  baselineDays: 28,
  rho: 0.35,
  missedTapRate: 0.1,
  illnessRate: 0.02,
  missingMetricRate: 0.02,
  deviceNoiseFraction: 0.1,
  weekendSwing: 0.25,
  testPolicy: 'both_directions' as const,
};
export const referenceScenario: Scenario = {
  ...base,
  id: '42d-3d-reference',
  label: '42 days / three-day blocks',
  schedule: { totalDays: 42, blockLengths: Array(14).fill(3) },
};
export const powerScenarios: readonly Scenario[] = [
  {
    ...base,
    id: '14d-normal',
    label: '14 days / original normal layout',
    schedule: { totalDays: 14 },
  },
  {
    ...base,
    id: '14d-carryover',
    label: '14 days / original carryover layout',
    schedule: { totalDays: 14, dropFirstNightOfBlock: true },
  },
  {
    ...base,
    id: '28d-normal',
    label: '28 days / repeated normal layout',
    schedule: { totalDays: 28, blockLengths: [3, 3, 3, 3, 1, 1, 3, 3, 3, 3, 1, 1] },
  },
  {
    ...base,
    id: '28d-2d',
    label: '28 days / two-day blocks',
    schedule: { totalDays: 28, blockLengths: Array(14).fill(2) },
  },
  referenceScenario,
  {
    ...referenceScenario,
    id: '42d-carryover',
    label: '42 days / carryover excluded',
    schedule: { ...referenceScenario.schedule, dropFirstNightOfBlock: true },
    carryoverDays: 1,
    carryoverFraction: 0.5,
  },
];
export const sensitivityScenarios: readonly Scenario[] = [
  {
    ...referenceScenario,
    id: 'outcome-missingness-stress',
    label: 'INVALID: omit bad on-nights',
    missingness: 'outcome_assignment_dependent',
  },
  ...[7, 56].map((baselineDays) => ({
    ...referenceScenario,
    id: `baseline-${baselineDays}`,
    label: `${baselineDays}-day baseline`,
    baselineDays,
  })),
  ...[0, 0.7].map((rho) => ({
    ...referenceScenario,
    id: `rho-${rho}`,
    label: `AR(1) rho ${rho}`,
    rho,
  })),
  ...[0, 0.25].map((missedTapRate) => ({
    ...referenceScenario,
    id: `missed-${missedTapRate}`,
    label: `${100 * missedTapRate}% missed taps`,
    missedTapRate,
  })),
  {
    ...referenceScenario,
    id: 'legacy-benefit-only',
    label: 'Legacy benefit-only tail',
    testPolicy: 'benefit_only',
  },
  {
    ...referenceScenario,
    id: 'two-night-carryover',
    label: 'Two-night carryover; only first excluded',
    schedule: { ...referenceScenario.schedule, dropFirstNightOfBlock: true },
    carryoverDays: 2,
    carryoverFraction: 0.5,
  },
  {
    ...referenceScenario,
    id: 'assignment-missingness',
    label: 'Assignment-dependent missing taps',
    missingness: 'assignment_dependent',
  },
];
export const metricScenarios: readonly Scenario[] = (
  [
    'sleepLatencyMinutes',
    'deepSleepMinutes',
    'remSleepMinutes',
    'wakeAfterSleepOnsetMinutes',
    'sleepEfficiencyPercent',
    'overnightHrvMs',
    'restingHeartRateBpm',
    'breathingRatePerMinute',
    'skinTemperatureDeviationC',
  ] as MetricField[]
).map((metric) => ({
  ...referenceScenario,
  id: `metric-${metric}`,
  label: metric,
  metric,
}));
export const coverageScenarios: readonly Scenario[] = [
  {
    ...referenceScenario,
    id: 'coverage-reference',
    label: 'Reference interval coverage',
    withInterval: true,
  },
  {
    ...referenceScenario,
    id: 'coverage-rho-0',
    label: 'Independent-night interval coverage',
    withInterval: true,
    rho: 0,
  },
  {
    ...referenceScenario,
    id: 'coverage-rho-0.7',
    label: 'High-correlation interval coverage',
    withInterval: true,
    rho: 0.7,
  },
  {
    ...referenceScenario,
    id: 'coverage-hrv',
    label: 'HRV interval coverage',
    withInterval: true,
    metric: 'overnightHrvMs',
  },
];
