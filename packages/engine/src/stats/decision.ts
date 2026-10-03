import type { PreRegistration, TestPolicy } from '../experiment/types.js';
import { immutable } from '../experiment/utils.js';
import type { RandomizationResult } from './randomization.js';
import type { InconclusiveReason, Verdict } from './types.js';

export function decideVerdict(input: {
  readonly direction: PreRegistration['direction'];
  readonly testPolicy: TestPolicy;
  readonly alpha: number;
  readonly difference: number | null;
  readonly test: RandomizationResult | null;
  readonly blockers: readonly InconclusiveReason[];
}): { readonly verdict: Verdict; readonly reasons: readonly InconclusiveReason[] } {
  if (
    input.alpha !== 0.05 ||
    !['higher', 'lower'].includes(input.direction) ||
    !['benefit_only', 'both_directions'].includes(input.testPolicy)
  )
    throw new Error('Invalid decision policy');
  const blocked = [...new Set(input.blockers)];
  if (blocked.length) return immutable({ verdict: 'Inconclusive', reasons: blocked });
  if (!input.test || input.difference === null || !Number.isFinite(input.difference))
    return immutable({ verdict: 'Inconclusive', reasons: ['randomization_not_estimable'] });
  const signed = input.difference * (input.direction === 'higher' ? 1 : -1);
  if (signed === 0) return immutable({ verdict: 'Inconclusive', reasons: ['no_difference'] });
  const threshold = input.testPolicy === 'both_directions' ? input.alpha / 2 : input.alpha;
  if (signed > 0 && input.test.beneficialP < threshold)
    return immutable({ verdict: 'Kept', reasons: [] });
  if (signed < 0 && input.testPolicy === 'both_directions' && input.test.oppositeP < threshold)
    return immutable({ verdict: 'Dropped', reasons: [] });
  return immutable({
    verdict: 'Inconclusive',
    reasons: [
      signed < 0 && input.testPolicy === 'benefit_only'
        ? 'opposite_direction_not_tested'
        : 'not_significant',
    ],
  });
}
