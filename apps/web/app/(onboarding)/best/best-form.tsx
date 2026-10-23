'use client';

import { useId } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Chip, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import {
  becoming,
  becomingOptions,
  MAX_BECOMING,
  ownWords,
  pairAnswer,
  pairs,
  setOwnWords,
  setPair,
  toggleBecoming,
} from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';

/** Step 4: who you are at your best. Four this-or-that taps, up to three "becoming", one optional line. */
export function BestForm() {
  const go = useGo();
  const { ready, progress, update } = useProgress();
  const ownId = useId();
  const name = progress.name.trim().split(/\s+/)[0] ?? '';
  const title = name ? copy.best.titleNamed(name) : copy.best.title;

  if (!ready)
    return (
      <section className="stack" aria-busy="true">
        <h1>{copy.best.title}</h1>
        <Skeleton kind="option" count={4} />
      </section>
    );

  const now = () => new Date().toISOString();
  const chosen = becoming(progress);
  const full = chosen.length >= MAX_BECOMING;

  return (
    <section className="stack screen-best">
      <h1>{title}</h1>
      <p className="lede">{copy.best.line}</p>

      <div className="tot-list">
        {pairs.map((pair, i) => {
          const picked = pairAnswer(progress, i);
          return (
            <div key={pair.q} className="tot" role="radiogroup" aria-label={pair.q}>
              {pair.options.map((o, k) => (
                <span key={o.label} className="tot-cell">
                  {k === 1 ? (
                    <span className="tot-or" aria-hidden="true">
                      {copy.best.or}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    role="radio"
                    aria-checked={picked === o.label}
                    className="tot-opt"
                    onClick={() => update((p) => setPair(p, i, o.label, now()))}
                  >
                    {o.label}
                  </button>
                </span>
              ))}
            </div>
          );
        })}
      </div>

      <div className="stack-tight becoming">
        <div className="becoming-head">
          <h2>{copy.best.becomingTitle}</h2>
          <span className="becoming-hint">{copy.best.becomingHint}</span>
        </div>
        <div className="chips" role="group" aria-label={copy.best.becomingTitle}>
          {becomingOptions.map((b) => {
            const on = chosen.includes(b);
            return (
              <Chip
                key={b}
                selected={on}
                aria-disabled={!on && full ? true : undefined}
                className={!on && full ? 'chip chip-full' : 'chip'}
                onClick={() => update((p) => toggleBecoming(p, b, now()))}
              >
                {b}
              </Chip>
            );
          })}
        </div>
        <label className="own-line" htmlFor={ownId}>
          <span className="goals-label">{copy.best.ownLabel}</span>
          <input
            id={ownId}
            value={ownWords(progress)}
            maxLength={120}
            enterKeyHint="done"
            placeholder={copy.best.ownPlaceholder}
            onChange={(e) => update((p) => setOwnWords(p, e.target.value, now()))}
          />
        </label>
      </div>

      <div className="actions">
        <Button onClick={() => go('yours')}>
          {copy.best.next}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}
