import { describe, expect, it } from 'vitest';
import { allChips, commonGroups, commonRow, isChip, morePlaces } from './common';
import { itemByKey } from './server';

describe('common items', () => {
  const common = commonGroups.flatMap((g) => allChips(g.items));
  const later = morePlaces.flatMap((p) => p.items);

  it('are routing-table rows at the table cost, each chip once, and the app asks only new rows', () => {
    for (const item of [...common, ...later])
      expect(itemByKey(item.key)?.monthlyCost, item.key).toBe(item.cost);
    const chips = [...common, ...later].map((i) => `${i.key} ${i.text}`);
    expect(new Set(chips).size).toBe(chips.length);
    const onboarding = new Set(common.map((i) => i.key));
    for (const item of later) expect(onboarding.has(item.key), item.key).toBe(false);
  });

  it('stay short lists to tap through', () => {
    // The specific chips under a general one (Gym, then which gym) only show once it's tapped.
    expect(commonGroups.flatMap((g) => g.items).length).toBeLessThanOrEqual(55);
    for (const g of [...commonGroups, ...morePlaces]) {
      expect(g.items.length).toBeGreaterThanOrEqual(5);
      expect(g.items.length).toBeLessThanOrEqual(14);
    }
  });

  it('tell chips on the same routing row apart by the name they leave', () => {
    const memberships = commonGroups.find((g) => g.id === 'memberships')!;
    const chips = allChips(memberships.items);
    const barrys = chips.find((c) => c.text === "Barry's")!;
    const f45 = chips.find((c) => c.text === 'F45')!;
    expect(barrys.key).toBe(f45.key);
    expect(isChip(commonRow(barrys, 0), barrys)).toBe(true);
    expect(isChip(commonRow(barrys, 0), f45)).toBe(false);
    const yoga = chips.find((c) => c.text === 'Yoga')!;
    const stretch = commonGroups.flatMap((g) => allChips(g.items)).find((c) => c.text === 'Stretching or yoga')!;
    expect(isChip(commonRow(yoga, 0), stretch)).toBe(false);
    expect(isChip(commonRow(stretch, 0), stretch)).toBe(true);
  });
});
