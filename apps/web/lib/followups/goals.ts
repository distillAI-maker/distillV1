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
