import type { Catalog, Goal } from '@distill/catalog';
import type { RuleAnswers } from '../rules/types.js';

/** Explicit aliases for the workbook's goal map; no fuzzy matching of medical goals. */
const aliases: Record<string, string> = {
  sleep: 'sleep (general)',
  cramps: 'joints / pain / soreness',
  recovery: 'recovery / stress / HRV',
  stress: 'recovery / stress / HRV',
  energy: 'energy',
  fitness: 'fitness',
  focus: 'focus / memory',
  memory: 'focus / memory',
  mood: 'mood / anxiety',
  anxiety: 'mood / anxiety',
  skin: 'skin / hair',
  hair: 'skin / hair',
  gut: 'gut / bloating',
  bloating: 'gut / bloating',
  pain: 'joints / pain / soreness',
  soreness: 'joints / pain / soreness',
  'fat loss': 'weight',
  weight: 'weight',
  immunity: 'immunity',
  'general health': 'longevity / general health',
  longevity: 'longevity / general health',
  'nothing specific': 'longevity / general health',
  testosterone: 'testosterone / hormones',
  hormones: 'testosterone / hormones',
};
const ruleAliases: Record<string, RuleAnswers['goal']> = {
  'sleep (general)': 'sleep',
  'falling asleep': 'sleep',
  'staying asleep / waking at night': 'sleep',
  'deep sleep': 'sleep',
  'focus / memory': 'focus',
  'mood / anxiety': 'mood',
  'skin / hair': 'skin',
  'gut / bloating': 'gut',
  'joints / pain / soreness': 'pain',
  weight: 'fat loss',
  'longevity / general health': 'general health',
  'testosterone / hormones': 'testosterone',
};
export function resolveGoal(catalog: Pick<Catalog, 'goals'>, input?: string): Goal | undefined {
  if (!input) return undefined;
  const name = Object.hasOwn(aliases, input) ? aliases[input] : input;
  return catalog.goals.find((goal) => goal.name === name);
}
export function ruleGoal(input: string | undefined, goal?: Goal): RuleAnswers['goal'] {
  // Preserve the distinctions used by item rules, e.g. soreness versus pain.
  if (
    input &&
    [
      'sleep',
      'cramps',
      'general health',
      'nothing specific',
      'mood',
      'skin',
      'pain',
      'soreness',
      'energy',
      'focus',
      'gut',
      'fat loss',
      'bone',
      'testosterone',
    ].includes(input)
  )
    return input as RuleAnswers['goal'];
  return goal ? ruleAliases[goal.name] : undefined;
}
