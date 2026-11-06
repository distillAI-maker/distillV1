import { describe, expect, it } from 'vitest';
import { commonGroups, allChips } from '../catalog/common';
import { leadUrl, THREADS, threadsFor } from './threads';

const item = (id: string, itemKey: string | null, extra: Record<string, unknown> = {}) => ({ id, itemKey, status: 'listed', ...extra });

describe('what opens a next step in Explore', () => {
  it('extends what they already do, and never adds something new', () => {
    const open = threadsFor({ items: [item('a', 'strength-training'), item('b', 'reading-paper-before-bed')] });
    expect(open.map((t) => t.id)).toEqual(['strength', 'reading']);
  });
  it('hears running in their own words', () => {
    expect(threadsFor({ items: [], words: 'Running along the Hudson while the day is still yours' }).map((t) => t.id)).toEqual(['running']);
    expect(threadsFor({ items: [item('a', null, { customName: 'Long run on Sundays' })] }).map((t) => t.id)).toEqual(['running']);
    expect(threadsFor({ items: [], words: 'I run a small business and run errands' })).toEqual([]);
  });
  it('never gives a next step to something let go of or suggested to go', () => {
    expect(threadsFor({ items: [item('a', 'strength-training', { status: 'cut' })] })).toEqual([]);
    expect(threadsFor({ items: [item('a', 'cold-plunge-ice-bath')], standings: { a: 'clear' } })).toEqual([]);
  });
  it('offers nothing for a pill on its own', () => {
    expect(threadsFor({ items: [item('a', 'magnesium-any-form'), item('b', 'greens-powder-ag1-etc')] })).toEqual([]);
  });
  it('points every thread at rows that exist', () => {
    const keys = new Set(commonGroups.flatMap((g) => allChips(g.items)).map((c) => c.key));
    for (const t of THREADS) for (const k of t.keys) expect(keys.has(k), `${t.id}: ${k}`).toBe(true);
  });
  it('has a search with their city in it for every next step', () => {
    const avenue = THREADS[0]!.avenues[0]!;
    const url = new URL(leadUrl(avenue, 'San Francisco', 2027));
    expect(url.searchParams.get('q')).toBe('upcoming 10K and half marathon races near San Francisco 2027');
  });
});
