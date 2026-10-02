import type { RuleAnswers, RuleOutcome } from './types.js';

export const t3 = (extra: Partial<RuleOutcome> = {}): RuleOutcome => ({ tier: 'T3', ...extra });
export const small = (extra: Partial<RuleOutcome> = {}): RuleOutcome => ({
  tier: 'T3_TOO_SMALL',
  canRunAnyway: true,
  ...extra,
});
export const t1 = (effect?: number, extra: Partial<RuleOutcome> = {}): RuleOutcome => ({
  tier: 'T1',
  ...(effect === undefined ? {} : { expectedEffect: effect }),
  ...extra,
});
export const drop = (reason: NonNullable<RuleOutcome['reason']>): RuleOutcome => ({
  tier: 'T2',
  reason,
});
export const missing = (...fields: (keyof RuleAnswers)[]): RuleOutcome =>
  t3({ needsAnswers: fields });
export const ambiguous = (id: string): RuleOutcome => t3({ teamQuestion: id });
export const notHypothesis = (): RuleOutcome => t3({ notHypothesis: true });
export const protectedItem = (): RuleOutcome => ({ tier: 'PROTECTED' });
export const keep = (): RuleOutcome => t3({ keep: true });

export function dose(
  a: RuleAnswers,
  floor: number,
  unit: RuleAnswers['doseUnit'],
  otherwise: RuleOutcome,
): RuleOutcome {
  if (a.dose === undefined || a.doseUnit !== unit) return missing('dose', 'doseUnit');
  return a.dose < floor ? drop('dose too low') : otherwise;
}
/** The source distinguishes >30 from >=30; retain each row's exact boundary. */
export function unused(a: RuleAnswers, threshold = 30, inclusive = false): boolean | undefined {
  if (a.daysSinceLastUse !== undefined)
    return inclusive ? a.daysSinceLastUse >= threshold : a.daysSinceLastUse > threshold;
  if (threshold !== 30) return undefined;
  if (a.lastUsed === 'longer' || a.lastUsed === 'cannot remember') return true;
  if (a.lastUsed === 'this week' || a.lastUsed === 'this month') return false;
  // The 1–3 month chip straddles the >30 boundary. Ask for the actual day count.
  return undefined;
}
export function usage(
  a: RuleAnswers,
  otherwise: RuleOutcome,
  threshold = 30,
  inclusive = false,
): RuleOutcome {
  const old = unused(a, threshold, inclusive);
  return old === undefined ? missing('daysSinceLastUse') : old ? drop('not being used') : otherwise;
}
export function paidUsage(
  a: RuleAnswers,
  otherwise: RuleOutcome,
  threshold = 30,
  inclusive = false,
): RuleOutcome {
  if (a.stillPaying === false) return otherwise;
  const old = unused(a, threshold, inclusive);
  if (old === false) return otherwise;
  if (a.stillPaying === undefined || old === undefined)
    return missing('stillPaying', 'daysSinceLastUse');
  return drop('not being used');
}
export function visitFloor(a: RuleAnswers, floor: number, otherwise: RuleOutcome): RuleOutcome {
  if (a.visitsLast30Days === undefined) return missing('visitsLast30Days');
  return a.visitsLast30Days < floor ? drop('not being used') : otherwise;
}
export function twoMonthFloor(a: RuleAnswers, floor: number, otherwise: RuleOutcome): RuleOutcome {
  if (a.visitsLast30Days === undefined) return missing('visitsLast30Days');
  if (a.visitsLast30Days >= floor) return otherwise;
  if (a.visitsPrevious30Days === undefined) return missing('visitsPrevious30Days');
  return a.visitsPrevious30Days < floor ? drop('not being used') : otherwise;
}
