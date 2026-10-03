'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { NightsChart } from '../../../components/nights-chart';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import type { Verdict } from '../../../lib/data/types';
import { useDataSource } from '../../../lib/data/use-source';
import { useProgress } from '../../../lib/progress/context';

const lowerFirst = (s: string) => (/^[A-Z][a-z]/.test(s) ? s[0]!.toLowerCase() + s.slice(1) : s);

/** The habit, the number, the swing and the word, with the template's sentence and the nights. */
export function VerdictView({ id, loadTemplates }: { id: string; loadTemplates?: Parameters<typeof useDataSource>[1] }) {
  const router = useRouter();
  const { ready, progress, update } = useProgress();
  const { source, failed, retry } = useDataSource(progress, loadTemplates);
  const [verdict, setVerdict] = useState<Verdict | null | undefined>(undefined);

  useEffect(() => {
    if (!ready || !source) return;
    let alive = true;
    source.verdicts(progress).then((list) => alive && setVerdict(list.find((v) => v.id === id) ?? null));
    return () => {
      alive = false;
    };
  }, [ready, source, progress, id]);

  const decided = progress.verdictChoices[id];

  function decide(choice: 'cut' | 'kept') {
    if (!verdict) return;
    update((p) => ({
      ...p,
      verdictChoices: { ...p.verdictChoices, [id]: choice },
      items: p.items.map((i) => (i.itemKey === verdict.itemKey ? { ...i, status: choice } : i)),
    }));
  }

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
  if (!ready || !source || verdict === undefined)
    return (
      <section className="stack" aria-busy="true">
        <Skeleton kind="line" />
        <Skeleton kind="title" count={2} />
        <Skeleton kind="option" count={2} />
      </section>
    );
  if (!verdict)
    return (
      <section className="stack">
        <h1>{copy.verdict.notFound}</h1>
        <div className="actions-row">
          <Link href="/verdicts" className="btn btn-ghost">
            {copy.verdict.listTitle}
          </Link>
        </div>
      </section>
    );

  const counted = verdict.nights.filter((n) => n.counted && n.value !== null).length;
  const sign = verdict.change < 0 ? '−' : '+';
  return (
    <section className="stack">
      <span className="label">{copy.verdict.eyebrow(verdict.name)}</span>
      <article className="glass vcard" aria-label={copy.verdict.eyebrow(verdict.name)}>
        <p className="effort">{copy.verdict.effort(verdict.effort.days, verdict.effort.taps)}</p>
        <h1 className="big">
          {sign}
          {Math.abs(verdict.change)} {verdict.unit}
          <small>{copy.verdict.numberLine(lowerFirst(verdict.metric))}</small>
        </h1>
        <dl>
          <dt>{copy.verdict.swingLabel}</dt>
          <dd>{copy.verdict.unit(verdict.swing, verdict.unit)}</dd>
          <dt>{copy.verdict.nightsLabel}</dt>
          <dd>{copy.verdict.of(counted, verdict.nights.length)}</dd>
        </dl>
        <p className="word">{verdict.word}</p>
        <p className="say">{verdict.text}</p>
        <NightsChart nights={verdict.nights} unit={verdict.unit} onLabel={verdict.name} />
        {decided ? (
          <p aria-live="polite">{decided === 'cut' ? copy.verdict.decidedCut : copy.verdict.decidedKept}</p>
        ) : (
          <div className="actions-row">
            {verdict.word === 'Kept' ? (
              <Button onClick={() => decide('kept')}>{copy.verdict.keepIt}</Button>
            ) : (
              <>
                <Button onClick={() => decide(verdict.word === 'Dropped' ? 'cut' : 'kept')}>
                  {verdict.word === 'Dropped' ? copy.verdict.letItGo : copy.verdict.keepIt}
                </Button>
                <Button variant="ghost" onClick={() => decide(verdict.word === 'Dropped' ? 'kept' : 'cut')}>
                  {verdict.word === 'Dropped' ? copy.verdict.keepItAnyway : copy.verdict.letItGo}
                </Button>
              </>
            )}
          </div>
        )}
      </article>
      {decided ? (
        <div className="glass card">
          <h2 style={{ fontSize: 20 }}>{copy.verdict.nextTitle('Alcohol in the evening')}</h2>
          <p className="muted" style={{ fontSize: 15 }}>
            {copy.verdict.nextObserve}
          </p>
          <div className="actions-row">
            <Button onClick={() => router.push('/today')}>{copy.verdict.lineUp}</Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
