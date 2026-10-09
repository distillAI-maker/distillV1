import type { DropReason, Item, Tier } from '@distill/catalog';
import type { RuleAnswers } from '../rules/types.js';

export interface InventoryItem {
  readonly id: string;
  readonly key: string;
  readonly name?: string;
  readonly monthlyCost?: number;
  /** Include a Protected item's cost in the total only with this explicit choice. */
  readonly includeProtectedInSummary?: boolean;
}
export interface StackAnswers extends Omit<RuleAnswers, 'goal' | 'inventoryKeys'> {
  readonly goal?: string;
  /** The person's goals in order; used for items that were not asked a goal of their own. */
  readonly goals?: readonly string[];
  readonly dataSource?: boolean;
  readonly usesLast30Days?: number;
  readonly caffeineWithinHourOfCoffee?: boolean;
  readonly multiContainsStudiedDose?: boolean;
  readonly hydrationRoutineDuplicates?: boolean;
}
export type AnswersById = Readonly<Record<string, Readonly<StackAnswers>>>;
export interface RoutingOptions {
  /** User choices are inventory IDs, never catalog keys (two products can share a key). */
  readonly overlapKeep?: Readonly<Record<string, string>>;
}
export type RoutingStep =
  | 'protected'
  | 'safety'
  | 'goal'
  | 'item_rule'
  | 'usage'
  | 'overlap'
  | 'effect_gate'
  | 'slow'
  | 'fallback'
  | 'source_conflict'
  | 'excluded';
export interface RoutedItem {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly tier: Tier;
  readonly step: RoutingStep;
  readonly unverified: boolean;
  readonly onDays: Item['onDays'];
  readonly monthlyCost?: number;
  readonly annualCost?: number;
  readonly reason?: DropReason;
  readonly detail?: string;
  readonly safety?: string | null;
  readonly keep?: boolean;
  readonly excluded?: boolean;
  readonly adjustedExpectedEffect?: number | null;
  readonly metric?: string;
  readonly directionText?: string | null;
  readonly evidenceGrade?: 'A' | 'B' | 'C' | 'D' | 'N' | null;
  readonly canRunAnyway?: boolean;
  readonly dailyRating?: string;
  readonly needsAnswers?: readonly string[];
  readonly teamQuestions?: readonly string[];
  readonly relatedExperiment?: string;
  readonly suggestedWeeks?: readonly [number, number];
  readonly notes?: readonly string[];
  readonly overlapIds?: readonly string[];
}
export interface OverlapDecision {
  readonly group: string;
  readonly itemIds: readonly string[];
  readonly status: 'suggested' | 'confirmed' | 'pending' | 'informational';
  readonly keepId?: string;
  readonly dropIds: readonly string[];
  readonly needsAnswers: readonly string[];
  readonly ruleText: string;
  /** Protected participants are reference-only; no individual cost or rating is exposed. */
  readonly monthlyTotal: number;
  readonly comparisons: readonly {
    id: string;
    usesLast30Days: number | null;
    costPerUse: number | null;
  }[];
}
export interface DayOneSummary {
  readonly itemsOnArrival: number;
  readonly monthlyTotal: number;
  readonly dropsToday: number;
  readonly monthlyBack: number;
  readonly annualBack: number;
  readonly linedUpForTesting: number;
  readonly queued: number;
  readonly cantMeasure: number;
  readonly keep: number;
  readonly protected: number;
  readonly excluded: number;
}
export interface RoutedStack {
  readonly items: readonly RoutedItem[];
  readonly drops: readonly RoutedItem[];
  readonly runnable: readonly RoutedItem[];
  readonly queued: readonly RoutedItem[];
  readonly cantMeasure: readonly RoutedItem[];
  readonly keep: readonly RoutedItem[];
  readonly protected: readonly RoutedItem[];
  readonly excluded: readonly RoutedItem[];
  readonly overlaps: readonly OverlapDecision[];
  readonly summary: DayOneSummary;
}
