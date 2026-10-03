import type { RoutedItem, RoutedStack } from '../route/types.js';
import { immutable } from './utils.js';

export interface SelectionFactors {
  readonly dataQuality: number;
  readonly historyStrength?: number;
}
export interface RankedCandidate {
  readonly item: RoutedItem;
  readonly score: number;
}
export interface SelectionCycle {
  readonly id: string;
  readonly vetoedItemId: string | null;
}
export function rankCandidates(
  stack: RoutedStack,
  factors: Readonly<Record<string, SelectionFactors>>,
): readonly RankedCandidate[] {
  const candidates = stack.runnable.filter(
    (item) =>
      item.tier === 'T1' &&
      !item.excluded &&
      !item.needsAnswers?.length &&
      !item.teamQuestions?.length &&
      item.metric &&
      item.onDays,
  );
  const ranked = candidates.map((item) => {
    const value = Object.hasOwn(factors, item.id) ? factors[item.id] : undefined;
    if (
      !value ||
      !Number.isFinite(value.dataQuality) ||
      value.dataQuality < 0 ||
      value.dataQuality > 1 ||
      (value.historyStrength !== undefined &&
        (!Number.isFinite(value.historyStrength) || value.historyStrength < 0))
    )
      throw new Error(`Invalid selection factors: ${item.id}`);
    if (
      item.adjustedExpectedEffect == null ||
      !Number.isFinite(item.adjustedExpectedEffect) ||
      item.adjustedExpectedEffect < 0
    )
      throw new Error('Missing adjusted effect');
    return {
      item,
      score: item.adjustedExpectedEffect * value.dataQuality * (value.historyStrength ?? 1),
    };
  });
  return immutable(
    ranked
      .filter((candidate) => factors[candidate.item.id]!.dataQuality > 0)
      .sort((a, b) => b.score - a.score || a.item.id.localeCompare(b.item.id)),
  );
}
export function selectCandidate(
  ranked: readonly RankedCandidate[],
  cycle: SelectionCycle,
): RankedCandidate | null {
  return ranked.find((candidate) => candidate.item.id !== cycle.vetoedItemId) ?? null;
}
export function vetoCandidate(
  cycle: SelectionCycle,
  ranked: readonly RankedCandidate[],
): SelectionCycle {
  if (cycle.vetoedItemId !== null) throw new Error('Veto already used in this cycle');
  const current = selectCandidate(ranked, cycle);
  if (!current) throw new Error('No candidate to veto');
  return immutable({ ...cycle, vetoedItemId: current.item.id });
}
