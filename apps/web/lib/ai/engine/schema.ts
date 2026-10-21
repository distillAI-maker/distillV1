/**
 * JSON schemas for structured output, built small. Every object is closed (additionalProperties
 * false) with every property required; optional values are nullable instead, which the zod side
 * turns back into "absent".
 */
type Schema = Record<string, unknown>;

export const str = (description?: string): Schema => ({ type: 'string', ...(description ? { description } : {}) });
export const num = (): Schema => ({ type: 'number' });
export const int = (): Schema => ({ type: 'integer' });
export const bool = (): Schema => ({ type: 'boolean' });
export const en = (values: readonly string[]): Schema => ({ type: 'string', enum: [...values] });
export const arr = (items: Schema): Schema => ({ type: 'array', items });
export const nul = (schema: Schema): Schema => ({ anyOf: [schema, { type: 'null' }] });
export const any = (...schemas: Schema[]): Schema => ({ anyOf: schemas });
export const obj = (properties: Record<string, Schema>): Schema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

/** Drops nulls from an object so optional zod fields read them as absent. */
export function dropNulls<T>(value: T): T {
  if (Array.isArray(value)) return value.map(dropNulls) as T;
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, dropNulls(v)]),
    ) as T;
  return value;
}
