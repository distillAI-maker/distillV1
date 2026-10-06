'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import type { Verdict } from '../../../lib/data/types';
import { useDataSource } from '../../../lib/data/use-source';
import { useProgress } from '../../../lib/progress/context';

export function VerdictsList({
  loadTemplates,
}: {
  loadTemplates?: Parameters<typeof useDataSource>[1];
}) {
  const { ready, progress } = useProgress();
  const { source, failed, retry } = useDataSource(progress, loadTemplates);
  const [list, setList] = useState<Verdict[] | null>(null);
  useEffect(() => {
    if (!ready || !source) return;
    let alive = true;
    source.verdicts(progress).then((v) => alive && setList(v));
    return () => {
      alive = false;
    };
  }, [ready, source, progress]);
  if (failed)
    return (
      <section className="stack">
        <p className="notice" role="alert">
          Your verdicts could not be loaded.
        </p>
        <Button onClick={retry}>Retry</Button>
      </section>
    );
  return (
    <section className="stack">
      <h1>{copy.verdict.listTitle}</h1>
      {!list ? (
        <Skeleton kind="option" count={2} />
      ) : list.length === 0 ? (
        <p className="lede">{copy.verdict.listEmpty}</p>
      ) : (
        <ul className="cards">
          {list.map((v) => (
            <li key={v.id}>
              <Link href={`/verdicts/${v.id}`} className="glass vrow">
                <span className="nm">{v.name}</span>
                <span className="wd">{v.word}</span>
                <small>
                  {v.change === null
                    ? 'Measurement unavailable'
                    : `${v.change < 0 ? '−' : '+'}${Math.abs(v.change)} ${v.unit}`}{' '}
                  · {v.decidedAt}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
