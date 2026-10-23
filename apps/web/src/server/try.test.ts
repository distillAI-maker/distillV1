import { describe, expect, it } from 'vitest';
import { engineCatalog } from '../../lib/catalog/engine';
import { tryList } from './try';

const run = (items: { key: string; feed?: boolean }[]) => tryList({ items }, engineCatalog('live'));
const by = (r: ReturnType<typeof run>, key: string) => r.items.find((i) => i.key === key)!;

describe("the landing page's list, on the app's engine", () => {
  it('asks about AG1 on its own, and lets it go once it came from a feed', () => {
    expect(by(run([{ key: 'greens-powder-ag1-etc' }]), 'greens-powder-ag1-etc').status).toBe('look');
    const r = run([{ key: 'greens-powder-ag1-etc', feed: true }]);
    expect(by(r, 'greens-powder-ag1-etc')).toMatchObject({ status: 'go', why: 'From a feed, and the evidence is thin' });
    expect(r.back).toBe(by(r, 'greens-powder-ag1-etc').monthly);
    expect(r.back).toBeGreaterThan(0);
  });

  it('lets greens go when a multivitamin already does the job, naming it', () => {
    const r = run([{ key: 'multivitamin' }, { key: 'greens-powder-ag1-etc' }]);
    expect(by(r, 'greens-powder-ag1-etc')).toMatchObject({ status: 'go', why: 'Your multivitamin already does this' });
    expect(by(r, 'multivitamin').status).not.toBe('go');
  });

  it('marks what is well-founded, and never lets something well-founded go for coming from a feed', () => {
    const r = run([{ key: 'vitamin-d3', feed: true }, { key: 'melatonin', feed: true }]);
    expect(r.items.map((i) => i.status)).toEqual(['founded', 'founded']);
    expect(r.back).toBe(0);
  });

  it('ignores keys it does not know and repeats, and stores nothing', () => {
    const r = run([{ key: 'not-a-thing' }, { key: 'melatonin' }, { key: 'melatonin' }]);
    expect(r.items.map((i) => i.key)).toEqual(['melatonin']);
    expect(run([])).toEqual({ items: [], back: 0 });
  });
});
