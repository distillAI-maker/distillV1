import type { Item } from '@distill/catalog';
import { itemRules } from './items.js';
import type { EvaluatedRule, ItemRule, RuleAnswers } from './types.js';
export { itemRules } from './items.js';
export type * from './types.js';

/** Phase 1 applies item rules only. Goal selection, inventory overlaps and ordering are Phase 3. */
export function evaluateItemRule(
  item: Readonly<Item>,
  answers: Readonly<RuleAnswers>,
): EvaluatedRule {
  const meta = { key: item.key, unverified: item.unverified, onDays: item.onDays };
  if (
    item.tier === 'PROTECTED' ||
    answers.source === 'doctor' ||
    answers.source === 'blood test' ||
    answers.prescription ||
    answers.hormone ||
    answers.clinicalService ||
    answers.diagnosedCondition
  )
    return { ...meta, tier: 'PROTECTED' };
  for (const [key, value] of Object.entries(answers)) {
    if (
      typeof value === 'number' &&
      (!Number.isFinite(value) || (value < 0 && key !== 'roomTemperatureC'))
    )
      throw new Error(`Invalid numeric answer: ${key}`);
    if (
      typeof value === 'number' &&
      /(?:NightsPerWeek|DaysPerWeek|nightsPerWeek)$/.test(key) &&
      (!Number.isInteger(value) || value > 7)
    )
      throw new Error(`Invalid weekly frequency: ${key}`);
    if (
      typeof value === 'number' &&
      /^(visits|bankedCredits)/.test(key) &&
      !Number.isInteger(value)
    )
      throw new Error(`Expected exact whole count: ${key}`);
  }
  const fn: ItemRule | undefined = Object.hasOwn(itemRules, item.key)
    ? (itemRules as Record<string, ItemRule>)[item.key]
    : undefined;
  if (!fn && item.ruleText !== 'Routes on the item name alone.')
    throw new Error(`Missing item rule: ${item.key}`);
  const result = fn
    ? fn(answers)
    : { tier: item.tier, ...(item.dropReason ? { reason: item.dropReason } : {}) };
  if (result.tier === 'PROTECTED') return { ...meta, tier: 'PROTECTED' };
  return { ...meta, ...result, monthlyCost: item.monthlyCost, safety: item.safety };
}
