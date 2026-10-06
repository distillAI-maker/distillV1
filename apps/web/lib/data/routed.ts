import type { Item } from '@distill/catalog';
import type { Progress, StackItem } from '../progress/types';
import { demoHypotheses, demoOverlaps, demoRouting } from './demo/routing';
import { buildEngineStack } from './engine';
import type { DayOneSummary, Landing, OverlapPair, RoutedItem, RoutedStack } from './types';

/**
 * Builds what the day-one screen renders. On the demo source every landing comes from the
 * Worked Example table; on any other source nothing is routed yet (Phase 3), so every item
 * waits under "Not read yet" with its cost counted. The summary is arithmetic over the landings
 * and the person's choices; it never applies a rule.
 */

export const protectedOrigins = new Set(['doctor', 'blood test']);

function landingFor(stack: StackItem, item: Item | undefined, source: Progress['dataSource']): Landing {
  const unverified = item?.unverified ?? false;
  if (stack.dataSource) {
    return { tier: 'PROTECTED', sentence: '', unverified: false, sentenceSource: 'none' };
  }
  if (stack.origin && protectedOrigins.has(stack.origin)) {
    return {
      tier: 'PROTECTED',
      sentence: item ? protectedSentence(item.name) : '',
      unverified: false,
      sentenceSource: item ? 'template.protected' : 'none',
    };
  }
  if (!item || !stack.itemKey) return { tier: 'T3', sentence: '', unverified: false, sentenceSource: 'none' };
  const demo = source === 'demo' ? demoRouting[stack.itemKey] : undefined;
  if (!demo) return { tier: 'T3', sentence: '', unverified, sentenceSource: 'none' };
  return {
    tier: demo.tier,
    reason: demo.reason,
    keep: demo.keep,
    canRunAnyway: demo.canRunAnyway,
    expectedEffect: demo.expectedEffect ?? item.expectedEffect,
    metric: item.metricText,
    chance: item.chance,
    dailyRating: demo.dailyRating,
    overlapGroup: demo.reason === 'overlaps with something else' ? item.overlapGroups[0] : undefined,
    sentence: item.dayOne,
    safety: item.safety,
    unverified,
    hypothesis: demoHypotheses[stack.itemKey],
    sentenceSource: 'catalog.dayOne',
  };
}

/** The Protected template (Verdict Templates!B17) with {item} filled. */
export function protectedSentence(name: string): string {
  return `${name}: this came from your clinician, so we don't rate it, test it, or suggest stopping it. It stays in your count only if you want it there.`;
}

/**
 * The demo person (the Worked Example, untouched) keeps the team's hand-routed fixture, which the
 * tests pin to the sheet. Every other stack goes through the real routing engine.
 */
export function usesDemoFixture(progress: Pick<Progress, 'dataSource' | 'prefilledFrom'>): boolean {
  return progress.dataSource === 'demo' && progress.prefilledFrom === 'demo';
}

export function buildRoutedStack(
  progress: Pick<Progress, 'items' | 'goals' | 'dataSource' | 'prefilledFrom'>,
  items: Map<string, Item>,
): RoutedStack {
  if (!usesDemoFixture(progress)) return buildEngineStack(progress, items);
  const routed: RoutedItem[] = progress.items.map((s) => {
    const item = s.itemKey ? items.get(s.itemKey) : undefined;
    return {
      stackItemId: s.id,
      itemKey: s.itemKey,
      name: item?.name ?? s.customName ?? '',
      category: item?.category ?? 'custom',
      monthlyCost: s.monthlyCost,
      origin: s.origin,
      landing: landingFor(s, item, progress.dataSource),
    };
  });
  const keys = new Set(routed.map((r) => r.itemKey));
  const overlaps: OverlapPair[] =
    progress.dataSource === 'demo'
      ? demoOverlaps
          .filter((o) => o.keys.every((k) => keys.has(k)))
          .map(({ group, keys: pair, suggestedDrop, facts }) => ({ group, keys: pair, suggestedDrop, facts }))
      : [];
  const queue = routed
    .filter((r) => r.landing.tier === 'T1' && r.itemKey && demoRouting[r.itemKey]?.order)
    .map((r) => {
      const d = demoRouting[r.itemKey as string];
      return {
        itemKey: r.itemKey as string,
        order: d?.order ?? 99,
        metric: r.landing.metric ?? '',
        direction: 'worse' as const,
        expectedEffect: r.landing.expectedEffect ?? 0,
        observeOnly: Boolean(d?.observeOnly),
        chance: r.landing.chance ?? 'not tested',
        hypothesis: r.landing.hypothesis,
      };
    })
    .sort((a, b) => a.order - b.order);
  return { items: routed, overlaps, queue };
}

export type Group = 'drop' | 'test' | 'cant' | 'keep' | 'protected' | 'unread';

/** Which group an item sits in once the person's switches are applied. */
export function groupOf(r: RoutedItem, routed: RoutedStack, dayOne: Progress['dayOne']): Group {
  const l = r.landing;
  if (l.tier === 'PROTECTED') return 'protected';
  // What the person said they'd never give up is theirs: never tested, never suggested to drop.
  if (dayOne.yours?.includes(r.stackItemId)) return 'keep';
  if (l.sentenceSource === 'none') return 'unread';
  // An overlap pair: the one the person keeps stays where the engine put it; the other goes.
  for (const pair of routed.overlaps) {
    if (!r.itemKey || !pair.keys.includes(r.itemKey)) continue;
    const kept = dayOne.overlapChoices[pair.group] ?? pair.keys.find((k) => k !== pair.suggestedDrop);
    const goes = r.itemKey !== kept;
    if (goes) return dayOne.keepAnyway.includes(r.stackItemId) ? 'keep' : 'drop';
    if (l.tier === 'T2') return 'keep';
  }
  if (l.tier === 'T2') return dayOne.keepAnyway.includes(r.stackItemId) ? 'keep' : 'drop';
  if (l.tier === 'T1' || l.tier === 'T1_QUEUED_SLOW' || l.tier === 'T1_QUEUED_SPECIAL') return 'test';
  if (l.tier === 'T3_TOO_SMALL') return dayOne.runAnyway.includes(r.stackItemId) ? 'test' : 'cant';
  return l.keep ? 'keep' : 'cant';
}

export function summarise(routed: RoutedStack, dayOne: Progress['dayOne']): DayOneSummary {
  const s: DayOneSummary = {
    count: routed.items.length,
    monthlyTotal: 0,
    dropsToday: 0,
    monthlyBack: 0,
    linedUp: 0,
    cantMeasure: 0,
    keep: 0,
    protectedCount: 0,
    notReadYet: 0,
  };
  for (const r of routed.items) {
    s.monthlyTotal += r.monthlyCost;
    const g = groupOf(r, routed, dayOne);
    if (g === 'drop') {
      s.dropsToday += 1;
      s.monthlyBack += r.monthlyCost;
    } else if (g === 'test') s.linedUp += 1;
    else if (g === 'cant') s.cantMeasure += 1;
    else if (g === 'keep') s.keep += 1;
    else if (g === 'protected') s.protectedCount += 1;
    else s.notReadYet += 1;
  }
  return s;
}

/** Statuses to save on the stack items when the person starts day one. */
export function statusesAfterDayOne(routed: RoutedStack, dayOne: Progress['dayOne']): Record<string, StackItem['status']> {
  const out: Record<string, StackItem['status']> = {};
  for (const r of routed.items) {
    const g = groupOf(r, routed, dayOne);
    out[r.stackItemId] =
      g === 'drop' ? 'cut' : g === 'test' ? 'testing' : g === 'protected' ? 'protected' : g === 'keep' ? 'kept' : 'listed';
  }
  return out;
}
