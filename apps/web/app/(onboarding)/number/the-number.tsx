'use client';

import { useEffect } from 'react';
import { Arrow } from '../../../components/ds/ui';
import { useGo } from '../../../components/onboarding/go';
import { copy } from '../../../lib/copy';
import { useRouted } from '../../../lib/data/use-routed';
import { track } from '../../../lib/track';

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/** Where each name starts, across the whole screen, before they gather into the spark. */
const spots: readonly [number, number][] = [
  [9, 15],
  [52, 27],
  [67, 43],
  [18, 51],
  [44, 66],
  [72, 72],
  [15, 78],
  [58, 16],
  [32, 37],
  [59, 56],
  [6, 31],
  [36, 85],
  [70, 8],
  [24, 24],
];

/**
 * The number: their own things' names appear across the screen, drift together and distil into one
 * spark, which rises above the count and the monthly cost. Under reduced motion it simply appears.
 */
export function TheNumber() {
  const go = useGo();
  const { routed, summary, failed, retry } = useRouted();
  useEffect(() => {
    if (summary)
      track('number_seen', { count: summary.count, monthly: Math.round(summary.monthlyTotal) });
  }, [summary]);

  if (failed)
    return (
      <div className="ob-content">
        <p className="ds-notice" role="alert">
          {copy.dayOne.error}
        </p>
        <button type="button" className="ds-secondary" onClick={retry}>
          {copy.common.tryAgain}
        </button>
      </div>
    );
  if (!routed || !summary)
    return (
      <div className="ob-content" aria-busy="true">
        <div className="ob-wait">
          <p>{copy.dayOne.reading}</p>
          <i />
          <i />
        </div>
      </div>
    );

  const names = routed.items
    .map((r) => r.name)
    .filter(Boolean)
    .slice(0, spots.length);
  return (
    <section className="ob-number" aria-live="polite">
      <div className="ob-number-names" aria-hidden="true">
        {names.map((name, i) => (
          <span
            key={`${name}-${i}`}
            className="ob-number-name"
            style={{ left: `${spots[i]![0]}%`, top: `${spots[i]![1]}%`, animationDelay: `${i * 80}ms` }}
          >
            {name}
          </span>
        ))}
      </div>
      <i className="ob-number-spark" aria-hidden="true" />
      <div className="ob-number-result">
        <h1>{copy.number.things(summary.count)}</h1>
        <strong className="ob-number-money">{copy.number.aMonth(money(summary.monthlyTotal))}</strong>
        <p>{copy.number.line}</p>
      </div>
      <button type="button" className="ds-primary ob-number-next" onClick={() => go('study')}>
        {copy.number.next}
        <Arrow />
      </button>
    </section>
  );
}
