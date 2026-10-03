'use client';

import { useRouter } from 'next/navigation';
import { Button, Chip, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { goalChips, nothingSpecific } from '../../../lib/followups/goals';
import { useProgress } from '../../../lib/progress/context';

export function GoalsForm() {
  const router = useRouter();
  const { ready, progress, update } = useProgress();
  const chosen = new Set(progress.goals);

  function toggle(sheet: string) {
    update((p) => {
      const has = p.goals.includes(sheet);
      if (has) return { ...p, goals: p.goals.filter((g) => g !== sheet) };
      // "Nothing specific" stands alone.
      if (sheet === nothingSpecific) return { ...p, goals: [nothingSpecific] };
      return { ...p, goals: [...p.goals.filter((g) => g !== nothingSpecific), sheet] };
    });
  }
  function next() {
    update({ step: 'questions' });
    router.push('/questions');
  }

  if (!ready)
    return (
      <section className="stack" aria-busy="true">
        <h1>{copy.goals.title}</h1>
        <p className="lede">{copy.goals.line}</p>
        <Skeleton kind="option" count={2} />
      </section>
    );

  return (
    <section className="stack">
      <h1>{copy.goals.title}</h1>
      <p className="lede">{copy.goals.line}</p>
      <div className="chips" role="group" aria-label={copy.goals.title}>
        {goalChips.map((g) => (
          <Chip key={g.sheet} selected={chosen.has(g.sheet)} onClick={() => toggle(g.sheet)}>
            {g.label}
          </Chip>
        ))}
      </div>
      <div className="actions">
        <Button onClick={next}>{copy.goals.continue}</Button>
      </div>
    </section>
  );
}
