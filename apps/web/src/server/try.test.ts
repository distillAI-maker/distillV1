import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { toneLint } from '@distill/engine';
import { copy } from '../../lib/copy';
import { catalog } from '../../lib/catalog/server';
import { engineCatalog } from '../../lib/catalog/engine';
import { tryList } from './try';

const run = (items: { key: string; feed?: boolean; feels?: boolean }[]) => tryList({ items }, engineCatalog('live'));
const by = (r: ReturnType<typeof run>, key: string) => r.items.find((i) => i.key === key)!;

describe("the landing page's list, on the app's engine", () => {
  it('asks about AG1 on its own, and lets it go once it came from a feed', () => {
    expect(by(run([{ key: 'greens-powder-ag1-etc' }]), 'greens-powder-ag1-etc').status).toBe('look');
    const r = run([{ key: 'greens-powder-ag1-etc', feed: true }]);
    expect(by(r, 'greens-powder-ag1-etc')).toMatchObject({ status: 'go', why: copy.landingTry.because['greens-powder-ag1-etc'] });
    expect(r.back).toBe(by(r, 'greens-powder-ag1-etc').monthly);
    expect(r.back).toBeGreaterThan(0);
  });

  it('lets greens go when a multivitamin already does the job, naming it', () => {
    const r = run([{ key: 'multivitamin' }, { key: 'greens-powder-ag1-etc' }]);
    expect(by(r, 'greens-powder-ag1-etc')).toMatchObject({ status: 'go', why: 'Your multivitamin already does this' });
    expect(by(r, 'multivitamin').status).not.toBe('go');
  });

  it('marks what is well-founded, and never lets something well-founded go for coming from a feed', () => {
    const r = run([{ key: 'vitamin-d3', feed: true }, { key: 'cold-plunge-ice-bath', feed: true }]);
    expect(r.items.map((i) => i.status)).toEqual(['founded', 'founded']);
    expect(r.back).toBe(0);
    expect(r.items[0]!.why).toMatch(/^The studies back it for /);
  });

  it('falls back to the plain reason for a row with no line of its own', () => {
    const r = run([{ key: 'evening-primrose-oil', feed: true }]);
    expect(by(r, 'evening-primrose-oil')).toMatchObject({ status: 'go', why: 'From a feed, and the evidence is thin' });
  });

  it('asks about mixed evidence, and lets it go on a "Not really", the same as the app', () => {
    const key = 'collagen-drinks-and-beauty-gummies';
    expect(by(run([{ key, feed: true }]), key).status).toBe('look');
    const r = run([{ key, feed: true, feels: false }]);
    expect(by(r, key).status).toBe('go');
    expect(r.back).toBe(by(r, key).monthly);
    expect(by(run([{ key, feed: true, feels: true }]), key).status).toBe('stays');
  });

  it('offers a habit that costs them as a swap, never a let-go', () => {
    for (const key of ['coffee-after-2pm', 'alcohol-in-the-evening', 'screens-phone-in-bed']) {
      const item = by(run([{ key, feed: true }]), key);
      expect(item.status).toBe('adjust');
      expect(item.why).toBe(copy.landingTry.because[key]);
      expect(item.instead).toBeTruthy();
    }
  });

  it('ignores keys it does not know and repeats, and stores nothing', () => {
    const r = run([{ key: 'not-a-thing' }, { key: 'vitamin-d3' }, { key: 'vitamin-d3' }]);
    expect(r.items.map((i) => i.key)).toEqual(['vitamin-d3']);
    expect(run([])).toEqual({ items: [], back: 0 });
  });

  describe('every chip on the landing page', () => {
    const page = readFileSync(join(__dirname, '../../../../public/index.html'), 'utf8');
    const chips = [...page.matchAll(/class="chip" data-k="([a-z0-9-]+)"/g)].map((m) => m[1]!);

    it('is a real row with something to say, alone or all tapped at once', () => {
      expect(chips.length).toBeGreaterThanOrEqual(24);
      expect(new Set(chips).size).toBe(chips.length);
      const each = chips.map((key) => by(run([{ key, feed: true }]), key));
      const all = run(chips.map((key) => ({ key, feed: true })));
      expect(all.items).toHaveLength(chips.length);
      for (const item of [...each, ...all.items]) {
        expect(item.status, item.key).not.toBe('stays');
        expect(item.why, item.key).toBeTruthy();
      }
    });

    it('mostly suggests letting go, with a few well-founded ones to keep it honest', () => {
      const statuses = chips.map((key) => by(run([{ key, feed: true }]), key).status);
      const count = (s: string) => statuses.filter((x) => x === s).length;
      expect(count('go') + count('look')).toBeGreaterThan(chips.length * 0.7);
      expect(count('founded')).toBeGreaterThanOrEqual(2);
      expect(count('founded')).toBeLessThanOrEqual(4);
    });

    it('has a short line of its own, in tone, for anything it could suggest changing', () => {
      for (const [key, line] of Object.entries(copy.landingTry.because)) {
        expect(chips, key).toContain(key);
        expect(line.length, key).toBeLessThanOrEqual(110);
        expect(toneLint(line, catalog.toneRules).filter((i) => i.code !== 'WORD_LIMIT'), key).toEqual([]);
      }
      for (const key of chips) {
        const { status } = by(run([{ key, feed: true }]), key);
        if (status !== 'founded') expect(copy.landingTry.because[key], key).toBeTruthy();
      }
    });
  });
});
