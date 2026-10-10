'use client';

import { useId } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Chip, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { goalChips, lifeGoalSheets, nothingSpecific } from '../../../lib/followups/goals';
import { useProgress } from '../../../lib/progress/context';

/**
 * Their ideal day, in their words, and the six goals the engine reads by. The words are kept for
 * them and never analysed; the goals tell the engine what to read.
 */
export function LifeForm() {
  const go = useGo();
  const { ready, progress, update } = useProgress();
  const id = useId();
  const chosen = new Set(progress.goals);
  const text = progress.lifeText;

  function toggle(sheet: string) {
    update((p) => {
      const has = p.goals.includes(sheet);
      if (has) return { ...p, goals: p.goals.filter((g) => g !== sheet) };
      if (sheet === nothingSpecific) return { ...p, goals: [nothingSpecific] };
      return { ...p, goals: [...p.goals.filter((g) => g !== nothingSpecific), sheet] };
    });
  }

  if (!ready)
    return (
      <section className="stack" aria-busy="true">
        <h1>{copy.life.title}</h1>
        <Skeleton kind="option" count={2} />
      </section>
    );

  return (
    <section className="stack screen-life">
      <h1>{copy.life.title}</h1>
      <div className="writing">
        <label className="sr-only" htmlFor={id}>
          {copy.life.label}
        </label>
        <textarea
          id={id}
          value={text}
          maxLength={4000}
          onChange={(e) => update({ lifeText: e.target.value })}
          placeholder={copy.life.placeholder}
          rows={7}
        />
        <div className="writing-foot">
          <span className="num">{text ? copy.life.chars(text.length) : copy.life.empty}</span>
        </div>
      </div>
      <div className="stack-tight goals-block">
        <h2 className="goals-label">{copy.life.goalsTitle}</h2>
        <div className="chips" role="group" aria-label={copy.life.goalsTitle}>
          {goalChips
            .filter((g) => lifeGoalSheets.includes(g.sheet))
            .map((g) => (
              <Chip key={g.sheet} selected={chosen.has(g.sheet)} onClick={() => toggle(g.sheet)}>
                {g.label}
              </Chip>
            ))}
        </div>
      </div>
      <div className="actions">
        <Button onClick={() => go('number')}>
          {copy.life.done}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}
