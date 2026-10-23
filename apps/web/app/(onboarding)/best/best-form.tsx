'use client';

import { useId } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Chip, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import {
  atBestLine,
  becoming,
  becomingOptions,
  busyAnswer,
  busyQuestion,
  dayAnswer,
  dayQuestions,
  dayRead,
  MAX_BECOMING,
  ownWords,
  protectedThing,
  setBusy,
  setDay,
  setOwnWords,
  toggleBecoming,
} from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';

/**
 * Step 4: you, at your best. A recent day that felt like you (who, where, doing what) and what a
 * busy week takes first, one tap each. Their day is read back to them as they tap, with what it
 * says about them and what Distill will protect. Then who they're becoming, and one optional line.
 */
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
  const mirror = atBestLine(progress);
  const read = dayRead(progress);
  const kept = protectedThing(progress);

  const rows = [
    ...dayQuestions.map((d) => ({
      key: d.id,
      q: d.q,
      options: d.options.map((o) => o.label),
      picked: dayAnswer(progress, d.id),
      pick: (label: string) => update((p) => setDay(p, d.id, label, now())),
    })),
    {
      key: 'busy',
      q: busyQuestion.q,
      options: [...busyQuestion.options],
      picked: busyAnswer(progress),
      pick: (label: string) => update((p) => setBusy(p, label, now())),
    },
  ];

  return (
    <section className="stack screen-best">
      <h1>{title}</h1>
      <p className="lede">{copy.best.line}</p>

      <ol className="day-list">
        {rows.map((r, i) => (
          <li key={r.key} className={`day-q${r.picked ? ' day-picked' : ''}`}>
            <span className="day-n" aria-hidden="true">
              {String(i + 1).padStart(2, '0')}
            </span>
            <span className="day-body">
              <span className="eyebrow-ink day-title">{r.q}</span>
              <span className="day-opts" role="radiogroup" aria-label={r.q}>
                {r.options.map((o) => (
                  <button
                    key={o}
                    type="button"
                    role="radio"
                    aria-checked={r.picked === o}
                    className="day-opt"
                    onClick={() => r.pick(o)}
                  >
                    {o}
                  </button>
                ))}
              </span>
            </span>
          </li>
        ))}
      </ol>

      {mirror || kept ? (
        <div className="mirror" aria-live="polite">
          {mirror ? (
            <p key={mirror} className="mirror-line">
              {mirror}
            </p>
          ) : null}
          {read ? (
            <p key={read} className="mirror-read">
              {read}
            </p>
          ) : null}
          {kept ? (
            <p key={kept} className="mirror-kept">
              <span className="mirror-dot" aria-hidden="true" />
              <span className="eyebrow-ink">{copy.best.protected}</span>
              <span className="mirror-thing">{kept}</span>
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="stack-tight becoming">
        <div className="becoming-head">
          <h2>{copy.best.becomingTitle}</h2>
          <span className="eyebrow-faint">{copy.best.becomingHint}</span>
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
          <span className="eyebrow-ink">{copy.best.ownLabel}</span>
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
