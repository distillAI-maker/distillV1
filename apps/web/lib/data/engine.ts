import type { Item } from '@distill/catalog';
import { routeStack } from '@distill/engine';
import type { InventoryItem, RoutedItem as EngineItem, StackAnswers } from '@distill/engine';
import { renderAuditVerdict } from '@distill/engine/verdict';
import { usualGoalFor } from '../followups/goals';
import { contextFor, ruleAnswers } from '../followups/resolve';
import type { Progress, StackItem } from '../progress/types';
import type { ExperimentPlan, Landing, OverlapPair, RoutedItem, RoutedStack } from './types';

/**
 * Routes a person's own stack through the real engine (Phases 3 and 7): the routing table's 210
 * rules, overlaps, the effect gate, and the day-one sentence for where each item actually landed.
 * Nothing here applies a rule of its own; it only shapes the engine's answer for the screens.
 */

type Input = Pick<Progress, 'items' | 'goals'>;

const protectedOrigins = new Set(['doctor', 'blood test']);

function answersFor(stack: StackItem, item: Item | undefined, input: Input): StackAnswers {
  const out: Record<string, unknown> = {};
  if (item) {
    const { answers } = ruleAnswers(item, stack, contextFor(input));
    for (const [k, v] of Object.entries(answers)) if (k !== 'inventoryKeys') out[k] = v;
  }
  if (stack.origin) out.source = stack.origin;
  if (stack.dataSource) out.dataSource = true;
  // The goal an item is judged by: the one the person gave for it, else the usual reason people
  // take it (a facial is for skin even when the headline goal is sleep), else their headline goal.
  if (item) {
    const explicit = typeof stack.answers.goal === 'string' ? stack.answers.goal : undefined;
    out.goal = explicit ?? usualGoalFor(item) ?? out.goal ?? 'general health';
  }
  return out as StackAnswers;
}

function sentenceFor(
  routed: EngineItem,
  item: Item | undefined,
  answers: StackAnswers,
  overlapPartner?: { name: string; monthlyCost: number },
): Pick<Landing, 'sentence' | 'sentenceSource'> {
  const text = renderAuditVerdict(routed, answers, {
    source: answers.source as never,
    otherItem: overlapPartner?.name,
    otherMonthlyCost: overlapPartner?.monthlyCost,
  });
  if (text.status === 'ready') return { sentence: text.text, sentenceSource: 'engine.audit' };
  if (routed.needsAnswers?.length) return { sentence: '', sentenceSource: 'none' };
  // The catalog's day-one sentence was written for the item's usual landing; use it only there.
  if (item && item.tier === routed.tier) return { sentence: item.dayOne, sentenceSource: 'catalog.dayOne' };
  return { sentence: '', sentenceSource: 'reason' };
}

function factsFor(c: { usesLast30Days: number | null; costPerUse: number | null } | undefined): string {
  if (!c) return '';
  if (c.usesLast30Days !== null && c.costPerUse !== null)
    return `${c.usesLast30Days} visits in 30 days, $${Math.round(c.costPerUse)} a visit`;
  if (c.usesLast30Days !== null) return `${c.usesLast30Days} uses in 30 days`;
  return '';
}

export function buildEngineStack(input: Input, items: Map<string, Item>): RoutedStack {
  const routable = input.items.filter(
    (s) => (s.itemKey && items.has(s.itemKey)) || s.dataSource || (s.origin && protectedOrigins.has(s.origin)),
  );
  const inventory: InventoryItem[] = routable.map((s) => ({
    id: s.id,
    key: s.itemKey ?? `custom:${s.id}`,
    name: s.itemKey ? items.get(s.itemKey)?.name : s.customName,
    monthlyCost: Number.isFinite(s.monthlyCost) ? Math.max(0, s.monthlyCost) : 0,
  }));
  const answers: Record<string, StackAnswers> = {};
  for (const s of routable) answers[s.id] = answersFor(s, s.itemKey ? items.get(s.itemKey) : undefined, input);

  let engine: ReturnType<typeof routeStack> | null = null;
  try {
    engine = routeStack(inventory, answers);
  } catch {
    engine = null;
  }
  const byId = new Map((engine?.items ?? []).map((r) => [r.id, r]));
  const stackById = new Map(input.items.map((s) => [s.id, s]));

  // Overlap pairs the engine suggests: the person always chooses on the Ready screen.
  const overlaps: OverlapPair[] = [];
  const partnerOf = new Map<string, { name: string; monthlyCost: number }>();
  for (const o of engine?.overlaps ?? []) {
    if (o.itemIds.length !== 2 || o.dropIds.length !== 1 || !o.keepId) continue;
    const [a, b] = o.itemIds.map((id) => stackById.get(id));
    if (!a?.itemKey || !b?.itemKey || a.itemKey === b.itemKey) continue;
    const drop = stackById.get(o.dropIds[0] as string);
    const keep = stackById.get(o.keepId);
    if (!drop?.itemKey || !keep?.itemKey) continue;
    overlaps.push({
      group: o.group,
      keys: [a.itemKey, b.itemKey],
      suggestedDrop: drop.itemKey,
      facts: {
        [a.itemKey]: factsFor(o.comparisons.find((c) => c.id === a.id)),
        [b.itemKey]: factsFor(o.comparisons.find((c) => c.id === b.id)),
      },
    });
    partnerOf.set(drop.id, { name: items.get(keep.itemKey)?.name ?? keep.itemKey, monthlyCost: keep.monthlyCost });
  }

  const routedItems: RoutedItem[] = input.items.map((s) => {
    const item = s.itemKey ? items.get(s.itemKey) : undefined;
    const r = byId.get(s.id);
    const base = {
      stackItemId: s.id,
      itemKey: s.itemKey,
      name: item?.name ?? s.customName ?? '',
      category: item?.category ?? ('custom' as const),
      monthlyCost: s.monthlyCost,
      origin: s.origin,
    };
    if (!r) {
      return {
        ...base,
        landing: { tier: 'T3', sentence: '', unverified: false, sentenceSource: 'none' } satisfies Landing,
      };
    }
    const said = sentenceFor(r, item, answers[s.id] ?? {}, partnerOf.get(s.id));
    const landing: Landing = {
      tier: r.tier,
      reason: r.reason,
      keep: r.keep,
      canRunAnyway: r.canRunAnyway,
      expectedEffect: r.adjustedExpectedEffect ?? item?.expectedEffect ?? null,
      metric: r.metric ?? item?.metricText ?? null,
      chance: item?.chance,
      dailyRating: r.dailyRating,
      overlapGroup: overlaps.find((o) => s.itemKey && o.keys.includes(s.itemKey))?.group,
      safety: r.safety ?? null,
      unverified: r.unverified,
      ...said,
    };
    return { ...base, landing };
  });

  const queue: ExperimentPlan[] = [...(engine?.runnable ?? []), ...(engine?.queued ?? [])]
    .map((r) => ({ r, item: items.get(r.key) }))
    .filter(({ r }) => !engine?.drops.some((d) => d.id === r.id))
    .sort((x, y) => (y.r.adjustedExpectedEffect ?? 0) - (x.r.adjustedExpectedEffect ?? 0))
    .map(({ r, item }, i) => ({
      itemKey: r.key,
      order: i + 1,
      metric: r.metric ?? item?.metricText ?? '',
      direction: 'worse' as const,
      expectedEffect: r.adjustedExpectedEffect ?? item?.expectedEffect ?? 0,
      observeOnly: item?.onDays === 'observe',
      chance: item?.chance ?? 'not tested',
    }));

  return { items: routedItems, overlaps, queue };
}
