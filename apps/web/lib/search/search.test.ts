import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/server';
import { handAliases } from './aliases';
import { buildIndex } from './index';
import { deriveAliases, matchText, normalise, search } from './match';

const index = buildIndex(catalog);
const top = (q: string) => search(q, index).map((e) => e.key);

describe('search index', () => {
  it('covers every catalog item once and stays small', () => {
    expect(index).toHaveLength(210);
    expect(new Set(index.map((e) => e.key)).size).toBe(210);
    expect(JSON.stringify(index).length).toBeLessThan(40_000);
  });
  it('only hand-writes aliases for keys that exist', () => {
    const keys = new Set(catalog.items.map((i) => i.key));
    for (const key of Object.keys(handAliases)) expect(keys.has(key), key).toBe(true);
  });
  it('derives aliases from parentheses and slashes', () => {
    expect(deriveAliases('Greens powder (AG1 etc.)')).toEqual(['Greens powder', 'AG1']);
    expect(deriveAliases('Meditation app (Calm, Headspace)')).toContain('Calm');
    expect(deriveAliases('Magnesium spray / oil (transdermal)')).not.toContain('oil');
  });
  it('normalises', () => {
    expect(normalise("  Barry's  Bootcamp! ")).toBe('barrys bootcamp');
  });
});

describe('search', () => {
  it.each([
    ['ag1', 'greens-powder-ag1-etc'],
    ['equinox', 'premium-gym-membership-equinox-life-time'],
    ['calm', 'meditation-app-calm-headspace'],
    ['peloton', 'fitness-app-subscription-peloton-app-apple-fitness-ladder'],
    ["barry's", 'boutique-class-membership-barry-s-soulcycle-f45-orangetheory'],
    ['barrys', 'boutique-class-membership-barry-s-soulcycle-f45-orangetheory'],
    ['restore', 'recovery-studio-membership-restore-remedy-place-othership'],
    ['massage envy', 'massage-membership-massage-envy-squeeze'],
    ['wine', 'alcohol-in-the-evening'],
    ['fish oil', 'omega-3-fish-oil'],
    ['spf', 'sunscreen-daily-spf-30'],
    ['reformer', 'yoga-pilates-studio'],
    ['facial', 'facials-monthly'],
    ['retinol', 'retinol-retinoid-nightly'],
    ['toner', 'toner-hydrating-or-balancing'],
    ['eye cream', 'eye-cream-when-you-already-use-a-moisturiser'],
    ['late dinner', 'late-dinner-within-2-3-h-of-bed'],
    ['vitamin c serum', 'vitamin-c-serum'],
    ['collagen gummies', 'collagen-drinks-and-beauty-gummies'],
  ])('%s finds %s first', (q, key) => {
    expect(top(q)[0]).toBe(key);
  });
  it('ranks magnesium rows first for a prefix', () => {
    for (const key of top('magnes').slice(0, 3)) expect(key.startsWith('magnesium')).toBe(true);
    expect(top('magnes')).toContain('magnesium-l-threonate');
  });
  it('forgives a typo', () => {
    expect(top('retnol')).toContain('retinol-retinoid-nightly');
    expect(top('melatonn')[0]).toBe('melatonin');
  });
  it('returns nothing for one character or nonsense', () => {
    expect(top('m')).toEqual([]);
    expect(top('zzqx')).toEqual([]);
  });
  it('caps results', () => {
    expect(search('a', index)).toHaveLength(0);
    expect(search('tea', index).length).toBeLessThanOrEqual(8);
  });
});

describe('matchText', () => {
  it('finds catalog items in a sentence, in order', () => {
    const keys = matchText(
      'I go to Equinox, take AG1 most mornings, do Pilates twice a week and drink wine on Fridays',
      index,
    ).map((e) => e.key);
    expect(keys).toEqual([
      'premium-gym-membership-equinox-life-time',
      'greens-powder-ag1-etc',
      'yoga-pilates-studio',
      'alcohol-in-the-evening',
    ]);
  });
  it('matches whole words only', () => {
    expect(matchText('I use a napkin', index).map((e) => e.key)).not.toContain(
      'afternoon-nap-after-3pm-or-over-30-min',
    );
  });
});
