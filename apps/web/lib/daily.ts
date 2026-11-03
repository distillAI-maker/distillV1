import { copy } from './copy';
import { pictureKindSchema, type Progress } from './progress/types';

/**
 * The day's question: one not asked before, about the part of "What we've learned about you" we
 * know least, so each answer fills in the picture. Once all are asked, they come round again.
 * Shared by the home screen and the engine's pick for today.
 */
export function pickQuestion(day: number, progress: Progress): string {
  const kinds = pictureKindSchema.options;
  const lines = progress.picture?.lines ?? [];
  const known = (k: string) => lines.filter((l) => l.kind === k).length;
  const turn = (k: string) => (kinds.indexOf(k as (typeof kinds)[number]) + day) % kinds.length;
  const asked = new Set(progress.asks.map((a) => a.q));
  for (const kind of [...kinds].sort((a, b) => known(a) - known(b) || turn(a) - turn(b))) {
    const next = (copy.home.questions[kind] as readonly Question[]).find((x) => !asked.has(x.q));
    if (next) return next.q;
  }
  const all = allQuestions();
  return (all[day % all.length] as Question).q;
}

export type Question = { q: string; eg: string };
export const allQuestions = (): readonly Question[] =>
  pictureKindSchema.options.flatMap((k): readonly Question[] => copy.home.questions[k]);


/** The example answer shown in the box for a question. */
export function exampleFor(q: string | undefined): string {
  return allQuestions().find((x) => x.q === q)?.eg ?? copy.home.learnPlaceholder;
}
