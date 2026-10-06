import { median } from '../experiment/utils.js';

export function mean(values: readonly number[]): number {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('Finite measurements required');
  const center = values[0]!;
  return center + values.reduce((sum, value) => sum + (value - center), 0) / values.length;
}
export function robustSd(values: readonly number[]): number {
  if (!values.length || values.some((value) => !Number.isFinite(value)))
    throw new Error('Finite measurements required');
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center))) * 1.4826;
}
/** Linear interpolation of the empirical quantile (type 7). */
export function quantile(sorted: readonly number[], probability: number): number {
  if (!sorted.length || probability < 0 || probability > 1) throw new Error('Invalid quantile');
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  return sorted[lower]! + (sorted[Math.ceil(position)]! - sorted[lower]!) * (position - lower);
}
