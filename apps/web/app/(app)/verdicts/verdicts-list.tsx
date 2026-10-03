'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import type { Verdict } from '../../../lib/data/types';
import { useDataSource } from '../../../lib/data/use-source';
import { useProgress } from '../../../lib/progress/context';

export function VerdictsList({ loadTemplates }: { loadTemplates?: Parameters<typeof useDataSource>[1] }) {
  const { ready, progress } = useProgress();
  const { source } = useDataSource(progress, loadTemplates);
  const [list, setList] = useState<Verdict[] | null>(null);
  useEffect(() => {
    if (!ready || !source) return;
    let alive = true;
    source.verdicts(progress).then((v) => alive && setList(v));
    return () => {
      alive = false;
    };
  }, [ready, source, progress]);
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
                  {v.change < 0 ? '−' : '+'}
                  {Math.abs(v.change)} {v.unit} · {v.decidedAt}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
