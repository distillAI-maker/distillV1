'use client';

import type { CSSProperties } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { useRouted } from '../../../lib/data/use-routed';

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/** The reckoning: their own item names drift in and gather, then the count and the monthly cost. */
export function TheNumber() {
  const go = useGo();
  const { routed, summary, failed, retry } = useRouted();

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
  if (!routed || !summary)
    return (
      <section className="theatre" aria-busy="true">
        <p className="lede">{copy.dayOne.reading}</p>
        <Skeleton kind="title" count={2} />
      </section>
    );

  const names = routed.items
    .map((r) => r.name)
    .filter(Boolean)
    .slice(0, 14);
  return (
    <section className="theatre" aria-live="polite">
      <div className="drift" aria-hidden="true">
        {names.map((name, i) => (
          <span
            key={`${name}-${i}`}
            style={
              {
                '--i': i,
                '--x': `${10 + ((i * 29) % 78)}%`,
                '--y': `${8 + ((i * 17) % 70)}%`,
              } as CSSProperties
            }
          >
            {name}
          </span>
        ))}
      </div>
      <div className="reckoning">
        <h1 className="reckon reckon-1">{copy.number.things(summary.count)}</h1>
        <p className="reckon reckon-2">{copy.number.aMonth(money(summary.monthlyTotal))}</p>
        <p className="reckon reckon-3">{copy.number.line}</p>
      </div>
      <div className="reckon reckon-4 actions">
        <Button onClick={() => go('sorted')}>
          {copy.number.showMe}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}
