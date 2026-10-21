import { describe, expect, it } from 'vitest';
import { tally, TO_SHIP } from '../../scripts/eval-ab';

describe('the blind A/B tally', () => {
  it('counts only picks of the new side as wins, and ships at 26 of 40', () => {
    const key = Object.fromEntries(Array.from({ length: 40 }, (_, i) => [`p${i + 1}`, i % 2 ? 'A' : 'B'])) as Record<string, 'A' | 'B'>;
    const picks = Object.fromEntries(Object.entries(key).map(([id, side], i) => [id, i < TO_SHIP ? side : i < 30 ? 'same' : side === 'A' ? 'B' : 'A'])) as Record<string, 'A' | 'B' | 'same'>;
    expect(tally(key, picks)).toEqual({ wins: 26, losses: 10, same: 4, ships: true });
    expect(tally(key, { ...picks, p1: picks.p1 === 'A' ? 'B' : 'A' }).ships).toBe(false);
  });
});
