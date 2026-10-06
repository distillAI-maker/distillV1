import report from '../../../data/power-results.json' with { type: 'json' };
import type { MetricField, ScheduleConfig, TestPolicy } from '@distill/engine/experiment';
import { immutable } from '../../engine/src/experiment/utils.js';
import type { CellResult } from './harness.js';

export const simulationReferenceProtocol: Readonly<ScheduleConfig> = immutable({
  totalDays: 42,
  blockLengths: Array<number>(14).fill(3),
  dropFirstNightOfBlock: false,
  minimumNightsPerSide: 5,
});
export type PowerGuidance =
  | { readonly status: 'unavailable'; readonly label: null; readonly reason: string }
  | {
      readonly status: 'estimated';
      readonly label: 'good' | 'fair' | 'low';
      readonly probability: number;
      readonly interval95: readonly [number, number];
      readonly attempts: number;
      readonly scenarioId: string;
      readonly interpretation: 'conditional_synthetic_model_not_personal_prediction';
      readonly assumptions: CellResult['scenario'];
    };
/** Empirical labels never reuse the workbook's two-week promise or extrapolate between sampled cells. */
export function powerGuidance(
  effect: number,
  config: ScheduleConfig,
  options: {
    metric?: MetricField;
    baselineDays?: number;
    testPolicy?: TestPolicy;
  } = {},
): PowerGuidance {
  const unavailable = (reason: string): PowerGuidance => ({
    status: 'unavailable',
    label: null,
    reason,
  });
  const lengths =
    // Only build the supported layout; invalid/unsupported configs cannot allocate arbitrary arrays.
    config.blockLengths ?? Array<number>(14).fill(3);
  if (config.blockLength !== undefined && config.blockLength !== 3)
    return unavailable('protocol_not_the_simulated_reference');
  if (
    (config.totalDays ?? 14) !== 42 ||
    lengths.length !== 14 ||
    lengths.some((length) => length !== 3) ||
    config.dropFirstNightOfBlock ||
    (config.minimumNightsPerSide ?? 5) !== 5 ||
    (options.baselineDays ?? 28) !== 28 ||
    (options.testPolicy ?? 'both_directions') !== 'both_directions'
  )
    return unavailable('protocol_not_the_simulated_reference');
  const metric = options.metric ?? 'totalSleepMinutes';
  const id = metric === 'totalSleepMinutes' ? '42d-3d-reference' : `metric-${metric}`;
  const cells = report.cells as unknown as readonly CellResult[];
  const cell = cells.find((entry) => entry.scenario.id === id && entry.effect === effect);
  if (
    !cell ||
    report.metadata.quick ||
    cell.trials < 500 ||
    cell.decisive.value === null ||
    !cell.decisive.interval95
  )
    return unavailable('effect_or_metric_not_estimated_with_enough_attempts');
  const lower = cell.decisive.interval95[0];
  return immutable({
    status: 'estimated',
    label: lower >= 0.5 ? 'good' : lower >= 1 / 3 ? 'fair' : 'low',
    probability: cell.decisive.value,
    interval95: cell.decisive.interval95,
    attempts: cell.trials,
    scenarioId: id,
    interpretation: 'conditional_synthetic_model_not_personal_prediction',
    assumptions: cell.scenario,
  });
}
