import type { DropReason, Item, Tier } from '@distill/catalog';
import type { Progress, StackItem } from '../progress/types';

/**
 * What the screens render. These mirror SPEC sections 6 to 10 and the engine's EvaluatedRule so
 * the Phase 3 to 7 output replaces the demo fixtures without touching a screen.
 */

export interface Landing {
  tier: Tier;
  reason?: DropReason;
  canRunAnyway?: boolean;
  keep?: boolean;
  expectedEffect?: number | null;
  /** The number we would watch, in the catalog's words. */
  metric?: string | null;
  chance?: Item['chance'];
  dailyRating?: string;
  overlapGroup?: string;
  /** The catalog's day-one sentence, word for word. */
  sentence: string;
  safety?: string | null;
  unverified: boolean;
  /** A day-one hypothesis from history, when the fixture or engine has one. Always labelled as such. */
  hypothesis?: string;
  /**
   * Where the sentence came from, for the record (DAY_ONE_SAMPLE_NUMBERS). 'engine.audit' is the
   * Phase 7 renderer for where the item actually landed; 'reason' means only the drop reason is shown.
   */
  sentenceSource: 'engine.audit' | 'catalog.dayOne' | 'template.protected' | 'reason' | 'none';
}

export interface RoutedItem {
  stackItemId: string;
  itemKey: string | null;
  name: string;
  category: Item['category'] | 'custom';
  monthlyCost: number;
  origin?: StackItem['origin'];
  landing: Landing;
}

export interface OverlapPair {
  group: string;
  keys: [string, string];
  /** The engine's suggestion. The person always chooses; this is only preselected. */
  suggestedDrop: string;
  /** Visits, last used or cost in words, one per key, for the side-by-side card. */
  facts: Record<string, string>;
}

export interface ExperimentPlan {
  itemKey: string;
  order: number;
  metric: string;
  direction: 'better' | 'worse';
  expectedEffect: number;
  observeOnly: boolean;
  chance: Item['chance'];
  hypothesis?: string;
}

export interface RoutedStack {
  items: RoutedItem[];
  overlaps: OverlapPair[];
  queue: ExperimentPlan[];
}

/** The day-one line: N things, $X a month. K come off today, $Y back. M lined up. */
export interface DayOneSummary {
  count: number;
  monthlyTotal: number;
  dropsToday: number;
  monthlyBack: number;
  linedUp: number;
  cantMeasure: number;
  keep: number;
  protectedCount: number;
  notReadYet: number;
}

export type Condition = 'on' | 'off';

export interface Experiment {
  id: string;
  itemKey: string;
  name: string;
  status: 'queued' | 'running' | 'done';
  /** ISO date of day 1. */
  startDate: string;
  /** The horizon the person sees now: 14, then 21 or 28 when a read came back too close. */
  days: number;
  maxDays?: number;
  plannedDays?: number;
  decision?: {
    status: 'in_progress' | 'extend' | 'ready';
    outcome?: string | null;
    nextLook?: string | null;
    chanceHelps?: number | null;
  };
  schedule: Condition[];
  observeOnly: boolean;
  metric: string;
  unit: string;
  direction: 'better' | 'worse';
  /** Locked before day one. Immutable; see SPEC non-negotiable 4. */
  prereg: {
    metric: string;
    direction: 'better' | 'worse';
    alpha: number;
    swing: number;
    schedule: Condition[];
    lockedAt: string;
  };
  /** The one line a morning shows, for an on day and an off day. */
  instruction: { on: string; off: string };
  monthlyCost: number;
  monthsIn?: number | null;
  nights?: Night[];
  through?: string;
  synthetic?: boolean;
  canFinish?: boolean;
  instructionForToday?: string;
}

export interface Night {
  date: string;
  condition: Condition;
  value: number | null;
  tap: 'did' | 'didnt' | 'unknown';
  counted: boolean;
}

export interface Verdict {
  id: string;
  experimentId: string;
  itemKey: string;
  name: string;
  word: 'Kept' | 'Dropped' | 'Inconclusive';
  templateName: string;
  /** The template, filled. Checked by toneLint in tests. */
  text: string;
  metric: string;
  unit: string;
  change: number | null;
  /** Unit of `change` when it differs from the metric's (percent for HRV); the chart keeps `unit`. */
  changeUnit?: string;
  swing: number | null;
  swingUnit?: string;
  synthetic?: boolean;
  reasons?: string[];
  nights: Night[];
  effort: { days: number; taps: number };
  monthlyCost: number;
  decidedAt: string;
  /** Estimate-based outcome behind the word: helps, costs_you, no_detectable_benefit, too_close_final. */
  outcome?: string;
  chanceHelps?: number;
  likelyRange?: { lower: number; upper: number; unit: string };
}

/**
 * The seam between the screens and the engine for what runs after day one. Demo now; Supabase
 * plus Phases 4 to 7 later. Day one itself is built by `buildRoutedStack` (routed.ts).
 */
export interface DataSource {
  readonly id: 'demo' | 'supabase';
  experiments(progress: Progress): Promise<Experiment[]>;
  verdicts(progress: Progress): Promise<Verdict[]>;
}
