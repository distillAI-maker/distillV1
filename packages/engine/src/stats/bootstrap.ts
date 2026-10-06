import { immutable } from '../experiment/utils.js';
import { mean, quantile } from './math.js';

export interface BootstrapOptions {
  readonly seed: number;
  readonly iterations?: number;
}
export interface BootstrapInterval {
  readonly method: 'condition_stratified_block_percentile';
  readonly level: 0.9;
  readonly lower: number;
  readonly upper: number;
  readonly seed: number;
  readonly iterations: number;
  readonly onBlocks: number;
  readonly offBlocks: number;
}
/** Resample whole scheduled blocks, never independent nights. No inference uses this interval. */
export function bootstrapInterval(
  on: readonly (readonly number[])[],
  off: readonly (readonly number[])[],
  options: BootstrapOptions,
): BootstrapInterval | null {
  const iterations = options.iterations ?? 5000;
  if (
    !Number.isInteger(options.seed) ||
    options.seed < 0 ||
    options.seed > 0xffffffff ||
    !Number.isInteger(iterations) ||
    iterations < 1000 ||
    iterations > 50000
  )
    throw new Error('Invalid bootstrap seed or iteration count');
  for (const block of [...on, ...off]) mean(block);
  if (on.length < 2 || off.length < 2) return null;
  let state = options.seed;
  const draw = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  };
  const resampleMean = (blocks: readonly (readonly number[])[]) => {
    const values: number[] = [];
    for (let i = 0; i < blocks.length; i++)
      values.push(...blocks[Math.floor(draw() * blocks.length)]!);
    return mean(values);
  };
  const differences = Array.from(
    { length: iterations },
    () => resampleMean(on) - resampleMean(off),
  ).sort((a, b) => a - b);
  return immutable({
    method: 'condition_stratified_block_percentile',
    level: 0.9,
    lower: quantile(differences, 0.05),
    upper: quantile(differences, 0.95),
    seed: options.seed,
    iterations,
    onBlocks: on.length,
    offBlocks: off.length,
  });
}
