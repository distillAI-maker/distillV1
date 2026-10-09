import data from '../../../../data/catalog.json' with { type: 'json' };
import { catalogSchema } from '@distill/catalog';
import type { Catalog, Goal, Item } from '@distill/catalog';
import { evaluateItemRule } from '../rules/index.js';
import { unused } from '../rules/helpers.js';
import { resolveGoal, ruleGoal } from './goals.js';
import { applyOverlaps } from './overlaps.js';
import type { WorkingItem } from './overlaps.js';
import { conditionalSourceConflicts, unconditionalKeeps } from './source-conflicts.js';
import type {
  AnswersById,
  InventoryItem,
  RoutedItem,
  RoutedStack,
  RoutingOptions,
} from './types.js';
export type * from './types.js';

const cents = (amount: number) => {
  if (!Number.isFinite(amount) || amount < 0 || !Number.isSafeInteger(Math.round(amount * 1200)))
    throw new Error('Invalid monthly cost');
  return Math.round(amount * 100);
};
const sumCosts = (items: readonly RoutedItem[]) =>
  items.reduce((sum, item) => sum + cents(item.monthlyCost ?? 0), 0) / 100;

function metricFor(
  catalog: Catalog,
  item: Item,
  goal: Goal,
  override?: string,
): string | undefined {
  if (goal.metricText === null) return undefined;
  if (override)
    return catalog.metrics.some((metric) => metric.name === override) &&
      (goal.name === 'sleep (general)' ||
        goal.metricText.toLowerCase().includes(override.toLowerCase()))
      ? override
      : undefined;
  const text = item.metricText?.toLowerCase() ?? '';
  const metrics = catalog.metrics
    .filter((metric) => text.includes(metric.name.toLowerCase()))
    .sort((a, b) => text.indexOf(a.name.toLowerCase()) - text.indexOf(b.name.toLowerCase()));
  if (goal.name === 'sleep (general)') return metrics[0]?.name;
  const match = metrics.find((metric) =>
    goal.metricText?.toLowerCase().includes(metric.name.toLowerCase()),
  );
  return match?.name;
}

/** Pure deterministic routing. Supply a catalog to test a reviewed source revision. */
export function createStackRouter(catalog: Catalog) {
  const byKey = new Map(catalog.items.map((item) => [item.key, item]));
  if (byKey.size !== catalog.items.length) throw new Error('Duplicate catalog key');
  return function routeStack(
    inventory: readonly InventoryItem[],
    answers: AnswersById,
    options: RoutingOptions = {},
  ): RoutedStack {
    const ids = new Set<string>();
    for (const entry of inventory) {
      if (!entry.id || ids.has(entry.id))
        throw new Error(`Missing or duplicate inventory ID: ${entry.id}`);
      ids.add(entry.id);
      if (entry.monthlyCost !== undefined) cents(entry.monthlyCost);
    }
    for (const id of Object.keys(answers))
      if (!ids.has(id)) throw new Error(`Answers for unknown inventory ID: ${id}`);
    for (const group of Object.keys(options.overlapKeep ?? {}))
      if (!catalog.overlapGroups.some((candidate) => candidate.name === group))
        throw new Error(`Unknown overlap group: ${group}`);
    const inventoryKeys = inventory.map((entry) => entry.key);
    const rows: WorkingItem[] = inventory.map((entry) => {
      const a = Object.hasOwn(answers, entry.id) ? answers[entry.id]! : {};
      if (
        a.usesLast30Days !== undefined &&
        (!Number.isInteger(a.usesLast30Days) || a.usesLast30Days < 0)
      )
        throw new Error('usesLast30Days must be a nonnegative whole count');
      const item = byKey.get(entry.key);
      const provenanceProtected =
        a.dataSource ||
        a.source === 'doctor' ||
        a.source === 'blood test' ||
        a.prescription ||
        a.hormone ||
        a.clinicalService ||
        a.diagnosedCondition;
      if (!item && !provenanceProtected) throw new Error(`Unknown catalog item: ${entry.key}`);
      const meta = {
        id: entry.id,
        key: entry.key,
        name: entry.name ?? item?.name ?? entry.key,
        unverified: item?.unverified ?? false,
        onDays: item?.onDays ?? null,
      };
      const protectedRow = (step: 'protected' | 'safety'): WorkingItem => ({
        inventory: entry,
        answers: a,
        item,
        routed: { ...meta, tier: 'PROTECTED', step },
        overlapEligible: false,
      });
      if (provenanceProtected || item?.tier === 'PROTECTED') return protectedRow('protected');
      if (!item) throw new Error(`Unknown catalog item: ${entry.key}`);
      // An item asked its own goal routes on it. Otherwise each of the person's goals is tried in
      // order and the first that settles the item (a drop, a test, a keep) wins; else the first goal.
      const attempt = (goalName: string | undefined): WorkingItem => {
      const goal = resolveGoal(catalog, goalName);
      const ruleAnswers = { ...a, goal: ruleGoal(goalName, goal), inventoryKeys };
      const rule = evaluateItemRule(item, ruleAnswers);
      // Item-specific safety redirects precede the goal and all financial recommendations.
      if (rule.tier === 'PROTECTED') return protectedRow('safety');
      const cost = cents(entry.monthlyCost ?? item.monthlyCost) / 100;
      const base: RoutedItem = {
        ...meta,
        tier: 'T3',
        step: 'fallback',
        monthlyCost: cost,
        annualCost: (cents(cost) * 12) / 100,
        safety: item.safety,
      };
      const row: WorkingItem = {
        inventory: entry,
        answers: a,
        item,
        routed: base,
        overlapEligible: false,
      };
      // The clinical boundary comes before any recommendation.
      if (goal?.name === 'testosterone / hormones') return protectedRow('protected');
      const conflict = conditionalSourceConflicts.has(item.key);
      // A drop settled by dose, form, evidence or mechanism holds whatever the goal is, and needs
      // none: 300 mg of fish oil is below the studied dose for every reason a person takes it.
      if (!conflict && rule.tier === 'T2' && rule.reason !== 'overlaps with something else') {
        row.routed = { ...base, tier: 'T2', step: 'item_rule', reason: rule.reason };
        return row;
      }
      // Something not being used is not being used for any goal either.
      if (unused(ruleAnswers) === true || (a.stillPaying === true && a.usesLast30Days === 0)) {
        row.routed = { ...base, tier: 'T2', step: 'usage', reason: 'not being used' };
        return row;
      }
      if (!goal) {
        row.routed = {
          ...base,
          step: 'goal',
          detail: goalName ? 'unknown_goal' : 'goal_required',
          needsAnswers: ['goal'],
        };
        return row;
      }
      if (goal.name === 'longevity / general health') {
        row.routed = { ...base, step: 'goal', detail: 'untestable_goal' };
        return row;
      }
      if (rule.excludeFromInventory) {
        row.routed = { ...base, step: 'excluded', excluded: true };
        return row;
      }
      if (conflict) {
        row.routed = {
          ...base,
          step: 'source_conflict',
          detail: 'conditional_columns_disagree',
          teamQuestions: ['COLUMN_CONFLICTS'],
        };
        return row;
      }
      const pendingRule = rule.needsAnswers?.length || rule.teamQuestion || rule.notHypothesis;
      const extra = {
        needsAnswers: rule.needsAnswers,
        teamQuestions: rule.teamQuestion ? [rule.teamQuestion] : undefined,
        notes: rule.notes,
        relatedExperiment: rule.relatedExperiment,
        suggestedWeeks: rule.suggestedWeeks,
      };
      row.overlapEligible = !rule.teamQuestion && !rule.notHypothesis;
      if (pendingRule) {
        row.routed = {
          ...base,
          ...extra,
          step: 'item_rule',
          detail: rule.notHypothesis ? 'not_a_hypothesis' : 'follow_up_required',
        };
        return row;
      }
      if (rule.keep || unconditionalKeeps.has(item.key)) {
        row.routed = {
          ...base,
          ...extra,
          keep: true,
          dailyRating: goal.dailyRating ? goal.name : undefined,
        };
        return row;
      }
      const effect = rule.expectedEffect ?? item.expectedEffect;
      const metric = metricFor(catalog, item, goal, rule.metric);
      const measured = {
        ...base,
        ...extra,
        adjustedExpectedEffect: effect,
        metric,
        directionText: item.directionText,
        evidenceGrade: item.evidenceGrade,
      };
      if (rule.tier === 'T3' || !metric || item.visibility === 'no') {
        row.routed = {
          ...measured,
          dailyRating: goal.dailyRating ? goal.name : undefined,
          detail: !metric ? 'no_metric_for_goal' : 'not_testable',
          teamQuestions:
            rule.dailyRating === 'stress' && !goal.dailyRating
              ? ['RATING_GOALS']
              : extra.teamQuestions,
        };
      } else if (rule.tier === 'T1_QUEUED_SPECIAL') {
        row.routed = {
          ...measured,
          tier: 'T1_QUEUED_SPECIAL',
          step: 'slow',
          detail: 'special_design_required',
        };
      } else if (item.speed === 'slow' || rule.tier === 'T1_QUEUED_SLOW') {
        row.routed = {
          ...measured,
          tier: 'T1_QUEUED_SLOW',
          step: 'slow',
          detail: 'long_blocks_required',
        };
      } else if (effect === null) {
        row.routed = {
          ...measured,
          step: 'source_conflict',
          detail: 'missing_effect',
          teamQuestions: ['MISSING_EFFECT'],
        };
        row.overlapEligible = false;
      } else if (effect >= 0.8) {
        row.routed = { ...measured, tier: 'T1', step: 'effect_gate' };
      } else {
        row.routed = {
          ...measured,
          tier: 'T3_TOO_SMALL',
          step: 'effect_gate',
          canRunAnyway: true,
          detail: 'too_small_for_two_weeks',
        };
      }
      return row;
      };
      const settled = (row: WorkingItem) =>
        ['PROTECTED', 'T2', 'T1', 'T1_QUEUED_SLOW', 'T1_QUEUED_SPECIAL', 'T3_TOO_SMALL'].includes(
          row.routed.tier,
        ) || Boolean(row.routed.keep);
      const choices: (string | undefined)[] =
        a.goal !== undefined ? [a.goal] : a.goals?.length ? [...a.goals] : [undefined];
      let chosen = attempt(choices[0]);
      for (const alternative of choices.slice(1)) {
        if (settled(chosen)) break;
        const candidate = attempt(alternative);
        if (settled(candidate) || (candidate.routed.metric && !chosen.routed.metric)) chosen = candidate;
      }
      return chosen;
    });
    const overlaps = applyOverlaps(catalog, rows, options);
    const items = rows.map((row) => row.routed);
    const drops = items.filter((item) => item.tier === 'T2');
    const runnable = items
      .filter((item) => item.tier === 'T1')
      .sort(
        (a, b) =>
          (b.adjustedExpectedEffect ?? 0) - (a.adjustedExpectedEffect ?? 0) ||
          a.id.localeCompare(b.id),
      );
    const queued = items.filter(
      (item) => item.tier === 'T1_QUEUED_SLOW' || item.tier === 'T1_QUEUED_SPECIAL',
    );
    const keep = items.filter((item) => item.keep && item.tier !== 'T2');
    const protectedItems = items.filter((item) => item.tier === 'PROTECTED');
    const excluded = items.filter((item) => item.excluded);
    const cantMeasure = items.filter(
      (item) =>
        (item.tier === 'T3' || item.tier === 'T3_TOO_SMALL') && !item.keep && !item.excluded,
    );
    const protectedCost =
      rows
        .filter((row) => row.routed.tier === 'PROTECTED' && row.inventory.includeProtectedInSummary)
        .reduce(
          (sum, row) => sum + cents(row.inventory.monthlyCost ?? row.item?.monthlyCost ?? 0),
          0,
        ) / 100;
    const monthlyBack = sumCosts(drops);
    return {
      items,
      drops,
      runnable,
      queued,
      keep,
      protected: protectedItems,
      excluded,
      cantMeasure,
      overlaps,
      summary: {
        itemsOnArrival: inventory.length,
        monthlyTotal: (Math.round(sumCosts(items) * 100) + Math.round(protectedCost * 100)) / 100,
        dropsToday: drops.length,
        monthlyBack,
        annualBack: (Math.round(monthlyBack * 100) * 12) / 100,
        linedUpForTesting: runnable.length,
        queued: queued.length,
        cantMeasure: cantMeasure.length,
        keep: keep.length,
        protected: protectedItems.length,
        excluded: excluded.length,
      },
    };
  };
}
export const routeStack = createStackRouter(catalogSchema.parse(data));
