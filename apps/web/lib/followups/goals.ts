import type { RuleAnswers } from '@distill/engine';

export type EngineGoal = NonNullable<RuleAnswers['goal']>;
export const nothingSpecific = 'nothing specific';

/** The Goal to Number sheet's names, shown as short chips, mapped to the words the rules read. */
export const goalChips: { sheet: string; label: string; engine: EngineGoal | null }[] = [
  { sheet: 'sleep (general)', label: 'Sleep', engine: 'sleep' },
  { sheet: 'falling asleep', label: 'Falling asleep', engine: 'sleep' },
  { sheet: 'staying asleep / waking at night', label: 'Staying asleep', engine: 'sleep' },
  { sheet: 'deep sleep', label: 'Deep sleep', engine: 'sleep' },
  { sheet: 'recovery / stress / HRV', label: 'Recovery and stress', engine: null },
  { sheet: 'energy', label: 'Energy', engine: 'energy' },
  { sheet: 'fitness', label: 'Fitness', engine: null },
  { sheet: 'focus / memory', label: 'Focus and memory', engine: 'focus' },
  { sheet: 'mood / anxiety', label: 'Mood', engine: 'mood' },
  { sheet: 'skin / hair', label: 'Skin and hair', engine: 'skin' },
  { sheet: 'gut / bloating', label: 'Gut', engine: 'gut' },
  { sheet: 'joints / pain / soreness', label: 'Joints and soreness', engine: 'pain' },
  { sheet: 'weight', label: 'Weight', engine: 'fat loss' },
  { sheet: 'immunity', label: 'Immunity', engine: null },
  { sheet: 'longevity / general health', label: 'General health', engine: 'general health' },
  { sheet: 'testosterone / hormones', label: 'Hormones', engine: 'testosterone' },
  { sheet: nothingSpecific, label: 'Nothing specific', engine: 'nothing specific' },
];

/** Labels for the engine's goal words, for the per-item goal question. */
export const engineGoalLabels: Record<EngineGoal, string> = {
  sleep: 'Sleep',
  cramps: 'Cramps',
  'general health': 'General health',
  'nothing specific': 'Nothing specific',
  mood: 'Mood',
  skin: 'Skin',
  pain: 'Pain',
  soreness: 'Soreness',
  energy: 'Energy',
  focus: 'Focus',
  gut: 'Gut',
  'fat loss': 'Weight',
  bone: 'Bone',
  testosterone: 'Hormones',
};

/** The engine goals a person's sheet goals map to, without duplicates. */
export function engineGoalsFor(sheetGoals: string[]): EngineGoal[] {
  const out: EngineGoal[] = [];
  for (const g of sheetGoals) {
    const chip = goalChips.find((c) => c.sheet === g);
    if (chip?.engine && !out.includes(chip.engine)) out.push(chip.engine);
  }
  return out;
}

/** Chips for "what is this one for": the person's goals first, then the two honest fallbacks. */
export function goalOptionsFor(sheetGoals: string[]): EngineGoal[] {
  const mine = engineGoalsFor(sheetGoals);
  const base = mine.length ? mine : (Object.keys(engineGoalLabels) as EngineGoal[]);
  const out = [...base];
  for (const extra of ['general health', 'nothing specific'] as const)
    if (!out.includes(extra)) out.push(extra);
  return out;
}

/** Goal words the engine's goal map understands, matched inside the catalog's free-text "usual goal". */
const usualWords = [
  'sleep', 'cramps', 'recovery', 'stress', 'energy', 'fitness', 'focus', 'memory', 'mood', 'anxiety',
  'skin', 'hair', 'gut', 'bloating', 'pain', 'soreness', 'fat loss', 'weight', 'immunity', 'longevity',
  'testosterone', 'hormones', 'general health',
];

/** Every usual reason people take an item, as goal words in the catalog's order. */
export function usualGoalsFor(item: { usualGoal?: string | null }): string[] {
  const text = (item.usualGoal ?? '').toLowerCase();
  if (!text) return [];
  const out: string[] = [];
  for (const part of text.split(/,|\/|;| and | or /)) {
    const hit = usualWords.find((w) => part.includes(w));
    if (hit && !out.includes(hit)) out.push(hit);
  }
  return out;
}
/** The usual reason people take an item, as one goal word, from the catalog's own text. */
export function usualGoalFor(item: { usualGoal?: string | null }): string | undefined {
  return usualGoalsFor(item)[0];
}

const ruleWordFor: Record<string, EngineGoal> = {
  sleep: 'sleep', cramps: 'cramps', energy: 'energy', focus: 'focus', memory: 'focus', mood: 'mood',
  anxiety: 'mood', skin: 'skin', hair: 'skin', gut: 'gut', bloating: 'gut', pain: 'pain', soreness: 'soreness',
  'fat loss': 'fat loss', weight: 'fat loss', longevity: 'general health', 'general health': 'general health',
  testosterone: 'testosterone', hormones: 'testosterone',
};

/** The rule's goal word for an item's usual reason, when the rules have one. */
export function usualRuleGoalFor(item: { usualGoal?: string | null }): EngineGoal | undefined {
  const word = usualGoalFor(item);
  return word ? ruleWordFor[word] : undefined;
}
