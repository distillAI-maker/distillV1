import { immutable } from '../experiment/utils.js';
import type { EffectEstimateV2 } from './estimate.js';
import type { Verdict } from './types.js';

/**
 * The decision policy is the product's judgement written as numbers. It is locked into every
 * registration before day one and never changes for a running experiment. Every threshold here
 * is explained in docs/ALGORITHM-IDENTITY.md with the simulation that measured it.
 */
export interface DecisionPolicy {
  readonly version: 'estimate_v2';
  /** Kept needs at least this posterior probability that the item helps. */
  readonly keepProbability: number;
  /** Dropped as "costs you" needs at least this probability that the item hurts. */
  readonly dropProbability: number;
  /** A decisive call also needs the posterior mean to be at least this far from zero. */
  readonly minimumDecisiveEffect: number;
  /** The size of effect counted as worthwhile, in swing units. */
  readonly worthwhileEffect: number;
  /** "Does nothing" needs the chance of a worthwhile benefit to be at most this. */
  readonly noBenefitProbability: number;
  /** Observed (not assigned) exposure needs a higher bar and a wider standard error. */
  readonly observedKeepProbability: number;
  readonly observedInflation: number;
  readonly minimumNightsPerSide: number;
  /** Days at which the posterior is read; the schedule runs to the last one. */
  readonly looks: readonly number[];
  /** Literature prior: expected effect times this shrink, with a width set by evidence grade. */
  readonly priorShrink: number;
  readonly priorSdByGrade: Readonly<Record<'A' | 'B' | 'C' | 'D' | 'N', number>>;
  readonly unknownDirectionPriorSd: number;
  readonly defaultRho: number;
  readonly rhoPriorWeight: number;
  readonly rhoMax: number;
}
export const estimateV2: DecisionPolicy = immutable({
  version: 'estimate_v2',
  keepProbability: 0.975,
  dropProbability: 0.975,
  minimumDecisiveEffect: 0.3,
  worthwhileEffect: 0.5,
  noBenefitProbability: 0.2,
  observedKeepProbability: 0.975,
  observedInflation: 1.25,
  minimumNightsPerSide: 5,
  looks: [14, 21, 28],
  // The literature decides what to test and how large an effect to look for. It does not vote on
  // the verdict: the prior is centred on zero, and its width only keeps a noisy fortnight honest.
  priorShrink: 0,
  priorSdByGrade: { A: 1.0, B: 1.0, C: 1.0, D: 1.0, N: 1.0 },
  unknownDirectionPriorSd: 1.0,
  defaultRho: 0.35,
  rhoPriorWeight: 10,
  rhoMax: 0.7,
});
export function assertDecisionPolicy(policy: DecisionPolicy): void {
  const unit = (value: number) => Number.isFinite(value) && value > 0 && value < 1;
  if (
    policy.version !== 'estimate_v2' ||
    !unit(policy.keepProbability) ||
    !unit(policy.dropProbability) ||
    !unit(policy.noBenefitProbability) ||
    !unit(policy.observedKeepProbability) ||
    policy.observedKeepProbability < Math.min(policy.keepProbability, policy.dropProbability) ||
    !(policy.minimumDecisiveEffect >= 0) ||
    !(policy.worthwhileEffect > 0) ||
    !(policy.observedInflation >= 1) ||
    !Number.isInteger(policy.minimumNightsPerSide) ||
    policy.minimumNightsPerSide < 5 ||
    !policy.looks.length ||
    policy.looks.some((day, i) => !Number.isInteger(day) || day < 7 || (i && day <= policy.looks[i - 1]!)) ||
    !(policy.priorShrink >= 0 && policy.priorShrink <= 1) ||
    (['A', 'B', 'C', 'D', 'N'] as const).some((grade) => !(policy.priorSdByGrade[grade] > 0)) ||
    !(policy.unknownDirectionPriorSd > 0) ||
    !(policy.defaultRho >= 0 && policy.defaultRho < 1) ||
    !(policy.rhoPriorWeight >= 0) ||
    !(policy.rhoMax >= 0 && policy.rhoMax < 1)
  )
    throw new Error('Invalid decision policy');
}

export type Outcome =
  | 'helps'
  | 'costs_you'
  | 'no_detectable_benefit'
  | 'too_close_extend'
  | 'too_close_final'
  | 'not_enough_nights'
  | 'in_progress';
export interface DecisionContext {
  readonly policy: DecisionPolicy;
  readonly design: 'randomized' | 'observational';
  /** True once the final look has been observed. */
  readonly complete: boolean;
  /** True when a look has been reached (the posterior may be read). */
  readonly atLook: boolean;
  readonly nightsOk: boolean;
}
export interface Decision {
  readonly verdict: Verdict;
  readonly outcome: Outcome;
  /** On a "does nothing" call: the nights leaned one way without clearing the bar. */
  readonly leans?: 'help' | 'harm';
}
const words: Readonly<Record<Outcome, Verdict>> = {
  helps: 'Kept',
  costs_you: 'Dropped',
  no_detectable_benefit: 'Dropped',
  too_close_extend: 'Inconclusive',
  too_close_final: 'Inconclusive',
  not_enough_nights: 'Inconclusive',
  in_progress: 'Inconclusive',
};
const decision = (outcome: Outcome): Decision => immutable({ verdict: words[outcome], outcome });

/** The same rule at every look. Nothing here depends on how many looks came before. */
export function decideFromEstimate(
  estimate: EffectEstimateV2 | null,
  context: DecisionContext,
): Decision {
  const { policy } = context;
  assertDecisionPolicy(policy);
  if (!context.atLook) return decision('in_progress');
  if (!estimate || !context.nightsOk)
    return decision(context.complete ? 'not_enough_nights' : 'too_close_extend');
  const bar =
    context.design === 'observational' ? policy.observedKeepProbability : policy.keepProbability;
  const dropBar =
    context.design === 'observational' ? policy.observedKeepProbability : policy.dropProbability;
  const { probabilities, posterior } = estimate;
  if (probabilities.helps >= bar && posterior.mean >= policy.minimumDecisiveEffect)
    return decision('helps');
  if (probabilities.hurts >= dropBar && posterior.mean <= -policy.minimumDecisiveEffect)
    return decision('costs_you');
  if (context.complete && probabilities.helpsWorthwhile <= policy.noBenefitProbability)
    return immutable({
      ...decision('no_detectable_benefit'),
      ...(probabilities.hurts >= 0.8 ? { leans: 'harm' as const } : {}),
    });
  return decision(context.complete ? 'too_close_final' : 'too_close_extend');
}

/** Prior centre and width from the catalogue row, in swing units with "helps" positive. */
export function literaturePrior(
  policy: DecisionPolicy,
  row: {
    readonly expectedEffect: number | null;
    readonly evidenceGrade: 'A' | 'B' | 'C' | 'D' | 'N' | null;
    readonly expected: 'helps' | 'hurts' | 'unknown';
  },
): { readonly mean: number; readonly sd: number } {
  const grade = row.evidenceGrade ?? 'D';
  if (row.expected === 'unknown' || row.expectedEffect === null)
    return immutable({ mean: 0, sd: policy.unknownDirectionPriorSd });
  const sign = row.expected === 'helps' ? 1 : -1;
  return immutable({
    mean: sign * policy.priorShrink * row.expectedEffect || 0,
    sd: policy.priorSdByGrade[grade],
  });
}
/** The catalogue's "which way it should move" text, read into an expected direction. */
export function expectedDirection(directionText: string | null | undefined): 'helps' | 'hurts' | 'unknown' {
  const text = (directionText ?? '').trim().toLowerCase();
  if (!text || text.endsWith('?') || text.includes('/')) return 'unknown';
  if (text.startsWith('worse')) return 'hurts';
  if (
    ['better', 'improve', 'up', 'fall asleep faster', 'hrv up', 'onset shorter'].some(
      (word) => text === word || text.startsWith(word),
    )
  )
    return 'helps';
  return 'unknown';
}
