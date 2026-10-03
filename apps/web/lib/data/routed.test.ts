import { toneLint } from '@distill/engine';
import { describe, expect, it } from 'vitest';
import { catalog } from '../catalog/server';
import { emptyProgress } from '../progress/types';
import { demoHypotheses, demoOverlaps, demoRouting } from './demo/routing';
import { demoGoals, demoStack } from './demo/stack';
import { buildRoutedStack, groupOf, protectedSentence, statusesAfterDayOne, summarise } from './routed';

const items = new Map(catalog.items.map((i) => [i.key, i]));
const demoProgress = () => ({
  ...emptyProgress(),
  step: 'day-one' as const,
  dataSource: 'demo' as const,
  goals: demoGoals,
  items: demoStack(),
});

describe('the demo routing fixture', () => {
  it('covers every catalog item in the demo stack and nothing else', () => {
    const keys = demoStack().map((s) => s.itemKey).filter((k): k is string => Boolean(k));
    expect(Object.keys(demoRouting).sort()).toEqual([...keys].sort());
    for (const k of Object.keys(demoRouting)) expect(items.has(k), k).toBe(true);
  });
  it('names overlap partners that are in the stack', () => {
    for (const o of demoOverlaps) for (const k of o.keys) expect(demoRouting[k], k).toBeTruthy();
  });
  it('hypothesis text is the catalog template example, and passes toneLint', () => {
    const template = catalog.verdictTemplates.find((t) => t.name.startsWith('Tier 1, day-one hypothesis'));
    expect(template?.example).toBe(demoHypotheses['training-after-7pm']);
    expect(toneLint(demoHypotheses['training-after-7pm'] as string, catalog.toneRules)).toEqual([]);
  });
  it('the Protected sentence is the template with the item filled', () => {
    const template = catalog.verdictTemplates.find((t) => t.name === 'Protected')!;
    expect(protectedSentence('Iron')).toBe(template.template.replace('{item}', 'Iron'));
    expect(toneLint(protectedSentence('Iron'), catalog.toneRules)).toEqual([]);
  });
});

describe('the Worked Example, as a day-one summary', () => {
  const progress = demoProgress();
  const routed = buildRoutedStack(progress, items);

  it('reproduces the sheet: 21 things, $1,428, 10 drops, $767 back, 4 lined up, 2 unmeasurable, 4 keep, 1 left alone', () => {
    expect(summarise(routed, progress.dayOne)).toEqual({
      count: 21,
      monthlyTotal: 1428,
      dropsToday: 10,
      monthlyBack: 767,
      linedUp: 4,
      cantMeasure: 2,
      keep: 4,
      protectedCount: 1,
      notReadYet: 0,
    });
  });
  it('queues coffee, drinks, training, dinner in the sheet order', () => {
    expect(routed.queue.map((q) => q.itemKey)).toEqual([
      'coffee-after-2pm',
      'alcohol-in-the-evening',
      'training-after-7pm',
      'late-dinner-within-2-3-h-of-bed',
    ]);
    expect(routed.queue[1]?.observeOnly).toBe(true);
    expect(routed.queue[2]?.hypothesis).toBeTruthy();
  });
  it('shows the gym pair side by side with Equinox suggested to stay', () => {
    expect(routed.overlaps).toHaveLength(1);
    expect(routed.overlaps[0]?.suggestedDrop).toBe('boutique-class-membership-barry-s-soulcycle-f45-orangetheory');
  });
  it('every sentence is the catalog day-one text, word for word', () => {
    for (const r of routed.items) {
      if (r.landing.sentenceSource !== 'catalog.dayOne') continue;
      expect(r.landing.sentence).toBe(items.get(r.itemKey as string)?.dayOne);
    }
  });
  it('"keep it anyway" moves a drop and its money', () => {
    const magnesium = routed.items.find((r) => r.itemKey === 'magnesium-any-form')!;
    const dayOne = { ...progress.dayOne, keepAnyway: [magnesium.stackItemId] };
    const s = summarise(routed, dayOne);
    expect([s.dropsToday, s.monthlyBack, s.keep]).toEqual([9, 745, 5]);
    expect(groupOf(magnesium, routed, dayOne)).toBe('keep');
  });
  it('swapping the overlap choice swaps which membership goes', () => {
    const dayOne = { ...progress.dayOne, overlapChoices: { 'fitness memberships': 'boutique-class-membership-barry-s-soulcycle-f45-orangetheory' } };
    const s = summarise(routed, dayOne);
    expect([s.dropsToday, s.monthlyBack]).toEqual([10, 817]);
    const equinox = routed.items.find((r) => r.itemKey === 'premium-gym-membership-equinox-life-time')!;
    expect(groupOf(equinox, routed, dayOne)).toBe('drop');
  });
  it('writes the statuses day one leaves behind', () => {
    const statuses = statusesAfterDayOne(routed, progress.dayOne);
    const counts = Object.values(statuses).reduce<Record<string, number>>((a, s) => ({ ...a, [s]: (a[s] ?? 0) + 1 }), {});
    expect(counts).toEqual({ cut: 10, testing: 4, kept: 4, protected: 1, listed: 2 });
  });
});

describe('a stack that is not the demo', () => {
  it('waits under "not read yet" with its cost counted and Protected still honoured', () => {
    const progress = { ...emptyProgress(), dataSource: 'oura' as const, items: demoStack().slice(0, 3) };
    progress.items[0]!.origin = 'doctor';
    const routed = buildRoutedStack(progress, items);
    const s = summarise(routed, progress.dayOne);
    expect(s).toMatchObject({ count: 3, monthlyTotal: 700, notReadYet: 2, protectedCount: 1, dropsToday: 0 });
    expect(routed.items[0]?.landing.sentence).toContain('this came from your clinician');
  });
});
