'use client';

import { useState } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { onShelves, shelves } from '../../../components/onboarding/groups';
import { Icon } from '../../../components/icon';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';

/** Four groups on one surface. The names and counts do the sorting; nothing is coloured to judge. */
export function Sorted() {
  const go = useGo();
  const { progress } = useProgress();
  const { routed, failed, retry } = useRouted();
  const [open, setOpen] = useState<number>(0);

  if (failed)
    return (
      <section className="stack">
        <p className="notice" role="alert">
          {copy.dayOne.error}
        </p>
        <div className="actions-row">
          <Button onClick={retry}>{copy.common.tryAgain}</Button>
        </div>
      </section>
    );
  if (!routed)
    return (
      <section className="stack" aria-busy="true">
        <p className="eyebrow">{copy.sorted.eyebrow}</p>
        <h1>{copy.sorted.title}</h1>
        <Skeleton kind="option" count={4} />
      </section>
    );

  const groups = onShelves(routed, progress.dayOne);
  return (
    <section className="stack screen-sorted">
      <p className="eyebrow">{copy.sorted.eyebrow}</p>
      <h1>{copy.sorted.title}</h1>
      <p className="lede">{copy.sorted.line}</p>
      <div className="shelves">
        {shelves.map((key, index) => {
          const rows = groups[key];
          const isOpen = open === index;
          const head = copy.sorted.groups[key];
          return (
            <div key={key} className={`shelf${isOpen ? ' open' : ''}`}>
              <button
                type="button"
                className="shelf-head"
                aria-expanded={isOpen}
                aria-controls={`shelf-${key}`}
                onClick={() => setOpen(isOpen ? -1 : index)}
              >
                <span className="shelf-top">
                  <span className="num">{String(rows.length).padStart(2, '0')}</span>
                  <span aria-hidden="true">{isOpen ? '−' : '+'}</span>
                </span>
                <span className="shelf-title">{head.title}</span>
                <span className="shelf-note">{head.note}</span>
              </button>
              <div className="shelf-body" id={`shelf-${key}`} hidden={!isOpen}>
                {rows.length ? (
                  <ul>
                    {rows.map((r) => (
                      <li key={r.stackItemId}>{r.name}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="muted">{copy.sorted.empty}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="actions">
        <Button onClick={() => go('ready')}>
          {copy.sorted.next}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}
