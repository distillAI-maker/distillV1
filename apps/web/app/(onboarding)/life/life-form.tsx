'use client';

import { useId } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Chip, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { goalChips, nothingSpecific } from '../../../lib/followups/goals';
import { useProgress } from '../../../lib/progress/context';

/**
 * The life they want, in their words, and what they'd most like to change. The words are shown
 * back to them on "Here's what we heard" and never analysed; the goals tell the engine what to read.
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
        <p className="eyebrow">{copy.life.eyebrow}</p>
        <h1>{copy.life.title}</h1>
        <Skeleton kind="option" count={2} />
      </section>
    );

  return (
    <section className="stack screen-life">
      <p className="eyebrow">{copy.life.eyebrow}</p>
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
      {text ? null : (
        <button
          type="button"
          className="suggestion"
          onClick={() => update({ lifeText: `${copy.life.starter} ` })}
        >
          <span>{copy.life.beginWith}</span>
          <q>{copy.life.starter}…</q>
        </button>
      )}
      <div className="stack-tight goals-block">
        <h2 className="h-small">{copy.life.goalsTitle}</h2>
        <p className="lede">{copy.life.goalsLine}</p>
        <div className="chips" role="group" aria-label={copy.life.goalsTitle}>
          {goalChips.map((g) => (
            <Chip key={g.sheet} selected={chosen.has(g.sheet)} onClick={() => toggle(g.sheet)}>
              {g.label}
            </Chip>
          ))}
        </div>
      </div>
      <div className="actions">
        <Button onClick={() => go('questions')}>
          {copy.life.done}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}
