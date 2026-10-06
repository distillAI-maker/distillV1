import { routeStack } from '@distill/engine';
import type { StackAnswers } from '@distill/engine';
import { catalog, itemByKey } from '../../lib/catalog/server';
import { contextFor, ruleAnswers } from '../../lib/followups/resolve';
import { protectedSentence } from '../../lib/data/routed';
import type { Progress } from '../../lib/progress/types';
import type { RoutedStack } from '../../lib/data/types';

/** One adapter for both the displayed audit and the candidates accepted by registration. */
export function audit(progress: Progress) {
  const known = progress.items.filter(
    (i) =>
      (i.itemKey && itemByKey(i.itemKey)) ||
      i.dataSource ||
      i.origin === 'doctor' ||
      i.origin === 'blood test',
  );
  const answers: Record<string, StackAnswers> = {};
  for (const stack of known) {
    const item = stack.itemKey ? itemByKey(stack.itemKey) : undefined;
    const a = item ? ruleAnswers(item, stack, contextFor(progress)).answers : {};
    answers[stack.id] = {
      ...a,
      source: stack.origin,
      dataSource: stack.dataSource,
      goal: typeof stack.answers.goal === 'string' ? stack.answers.goal : progress.goals[0],
    };
  }
  const overlapKeep = Object.fromEntries(
    Object.entries(progress.dayOne.overlapChoices)
      .map(([group, key]) => [group, progress.items.find((i) => i.itemKey === key)?.id])
      .filter(
        (entry): entry is [string, string] =>
          Boolean(entry[1]) && catalog.overlapGroups.some((g) => g.name === entry[0]),
      ),
  );
  return routeStack(
    known.map((i) => ({
      id: i.id,
      key: i.itemKey ?? i.id,
      name: i.customName,
      monthlyCost: i.monthlyCost,
    })),
    answers,
    { overlapKeep },
  );
}

export function screenAudit(progress: Progress): RoutedStack {
  const result = audit(progress);
  return {
    items: progress.items.map((stack) => {
      const row = result.items.find((r) => r.id === stack.id);
      const item = stack.itemKey ? itemByKey(stack.itemKey) : undefined;
      const unresolved =
        !row || Boolean(row.needsAnswers?.length || row.teamQuestions?.length || row.excluded);
      return {
        stackItemId: stack.id,
        itemKey: stack.itemKey,
        name: item?.name ?? stack.customName ?? '',
        category: item?.category ?? 'custom',
        monthlyCost: stack.monthlyCost,
        origin: stack.origin,
        landing: {
          tier: row?.tier ?? 'T3',
          reason: row?.reason,
          keep: row?.keep,
          canRunAnyway: row?.canRunAnyway,
          expectedEffect: row?.adjustedExpectedEffect,
          metric: row?.metric,
          chance: item?.chance,
          dailyRating: row?.dailyRating,
          safety: row?.safety,
          unverified: row?.unverified ?? false,
          sentence:
            row?.tier === 'PROTECTED'
              ? protectedSentence(item?.name ?? stack.customName ?? 'This item')
              : unresolved
                ? 'More information or source review is needed before this item can be rated.'
                : (item?.dayOne ?? ''),
          sentenceSource:
            row?.tier === 'PROTECTED'
              ? 'template.protected'
              : unresolved
                ? 'none'
                : 'catalog.dayOne',
        },
      };
    }),
    overlaps: result.overlaps
      .filter(
        (o) =>
          o.itemIds.length === 2 &&
          o.keepId &&
          o.dropIds.length &&
          ['suggested', 'confirmed'].includes(o.status),
      )
      .map((o) => {
        const keys = o.itemIds.map((id) => progress.items.find((i) => i.id === id)!.itemKey!) as [
          string,
          string,
        ];
        return {
          group: o.group,
          keys,
          suggestedDrop: progress.items.find((i) => i.id === o.dropIds[0])!.itemKey!,
          facts: Object.fromEntries(
            o.comparisons.map((c) => [
              progress.items.find((i) => i.id === c.id)!.itemKey!,
              c.usesLast30Days === null
                ? 'Use not recorded'
                : `${c.usesLast30Days} uses in the last 30 days`,
            ]),
          ),
        };
      }),
    queue: result.runnable
      .filter((r) => !r.needsAnswers?.length && !r.teamQuestions?.length)
      .map((r, i) => ({
        itemKey: r.key,
        order: i + 1,
        metric: r.metric ?? '',
        direction: 'better',
        expectedEffect: r.adjustedExpectedEffect ?? 0,
        observeOnly: r.onDays === 'observe',
        chance: itemByKey(r.key)?.chance ?? 'not tested',
      })),
  };
}
