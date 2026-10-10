'use client';

import { useState } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { onShelves, shelves } from '../../../components/onboarding/groups';
import { Icon } from '../../../components/icon';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';

/** Four groups, as the Figma build draws them: a coloured card each, tap to open. No red. */
export function Sorted() {
  const go = useGo();
  const { progress } = useProgress();
  const { routed, failed, retry } = useRouted();
  // Null until they tap: then the first group that holds anything starts open.
  const [open, setOpen] = useState<number | null>(null);

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
        <h1>{copy.sorted.title}</h1>
        <Skeleton kind="option" count={4} />
      </section>
    );

  const groups = onShelves(routed, progress.dayOne);
  const opened =
    open ??
    Math.max(
      0,
      shelves.findIndex((k) => groups[k].length > 0),
    );
  return (
    <section className="stack screen-sorted">
      <h1>{copy.sorted.title}</h1>
      <div className="shelves">
        {shelves.map((key, index) => {
          const rows = groups[key];
          const isOpen = opened === index;
          const head = copy.sorted.groups[key];
          return (
            <div key={key} className={`shelf shelf-${key}${isOpen ? ' open' : ''}`}>
              <button
                type="button"
                className="shelf-head"
                aria-expanded={isOpen}
                aria-controls={`shelf-${key}`}
                onClick={() => setOpen(isOpen ? -1 : index)}
              >
                <span className="shelf-top" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
                <span className="shelf-title">{head.title}</span>
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
