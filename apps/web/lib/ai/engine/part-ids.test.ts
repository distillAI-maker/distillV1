import { describe, expect, it } from 'vitest';
import { resolvePartId } from './compose';

const parts = [
  { id: 'part:veer-run', title: 'Morning run' },
  { id: 'part:veer-meditation', title: 'Morning meditation' },
];

describe('reading the part Claude meant', () => {
  it('keeps an exact id', () => expect(resolvePartId('part:veer-run', parts)).toBe('part:veer-run'));
  it('adds a missing prefix', () => expect(resolvePartId('veer-run', parts)).toBe('part:veer-run'));
  it('reads a title as its part', () => expect(resolvePartId('"Morning meditation"', parts)).toBe('part:veer-meditation'));
  it('leaves an unknown id for the checks to reject', () => expect(resolvePartId('p1', parts)).toBe('p1'));
});
