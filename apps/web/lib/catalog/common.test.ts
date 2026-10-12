import { describe, expect, it } from 'vitest';
import { commonGroups, morePlaces } from './common';
import { itemByKey } from './server';

describe('common items', () => {
  const common = commonGroups.flatMap((g) => g.items);
  const later = morePlaces.flatMap((p) => p.items);

  it('are routing-table rows at the table cost, each once across onboarding and the app', () => {
    for (const item of [...common, ...later])
      expect(itemByKey(item.key)?.monthlyCost, item.key).toBe(item.cost);
    const keys = [...common, ...later].map((i) => i.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('stay short lists to tap through', () => {
    expect(common.length).toBeLessThanOrEqual(55);
    for (const g of [...commonGroups, ...morePlaces]) {
      expect(g.items.length).toBeGreaterThanOrEqual(5);
      expect(g.items.length).toBeLessThanOrEqual(14);
    }
  });
});
