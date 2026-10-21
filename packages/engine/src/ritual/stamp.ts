import type { EngineStamp } from './types.js';

/** The engine's own version, bumped when a rule changes what it decides. */
export const ENGINE_VERSION = 'ritual-1.0.0';

/** A short, stable hash for stamping outputs (not for security). FNV-1a, 64-bit, as hex. */
export function hashOf(value: unknown): string {
  const text = typeof value === 'string' ? value : stableJson(value);
  let h1 = 0x811c9dc5,
    h2 = 0x01000193;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ c, 2246822519);
  }
  return ((h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0'));
}

/** JSON with sorted keys, so the same input always hashes the same. */
export function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((value as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}

export function stamp(input: {
  catalogVersion: string;
  inputs: unknown;
  promptVersion?: string;
  model?: string;
  gitSha?: string;
}): EngineStamp {
  return {
    engineVersion: input.gitSha ? `${ENGINE_VERSION}+${input.gitSha.slice(0, 12)}` : ENGINE_VERSION,
    catalogVersion: input.catalogVersion,
    ...(input.promptVersion ? { promptVersion: input.promptVersion } : {}),
    ...(input.model ? { model: input.model } : {}),
    inputsHash: hashOf(input.inputs),
  };
}
