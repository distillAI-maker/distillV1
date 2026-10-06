'use client';

import { useEffect, useMemo, useState } from 'react';
import { DayStrip } from '../../../components/day-strip';
import { Button, ButtonLink, Chip, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { nightsWithTaps } from '../../../lib/data/demo';
import type { Experiment, Night } from '../../../lib/data/types';
import { useDataSource } from '../../../lib/data/use-source';
import { useProgress } from '../../../lib/progress/context';

/** One instruction line, two buttons, and the fortnight so far. */
export function Today({ loadTemplates }: { loadTemplates?: Parameters<typeof useDataSource>[1] }) {
  const { ready, progress, update } = useProgress();
  const { source, failed, retry } = useDataSource(progress, loadTemplates);
  const [exp, setExp] = useState<Experiment | null | undefined>(undefined);
  const [noted, setNoted] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !source) return;
    let alive = true;
    source.experiments(progress).then((list) => alive && setExp(list[0] ?? null));
    return () => {
      alive = false;
    };
  }, [ready, source, progress]);

  const nights: Night[] = useMemo(() => (exp ? nightsWithTaps(exp, progress) : []), [exp, progress]);
  const todayIndex = exp ? exp.days - 1 : 0;
  const tonight = nights[todayIndex];
  const lastNight = nights[todayIndex - 1];
  const own = exp ? (progress.taps[exp.id] ?? {}) : {};
  const tappedToday = tonight ? own[tonight.date]?.value : undefined;
  const allTapped = exp ? nights.every((n, i) => (i < todayIndex ? true : Boolean(own[n.date]))) : false;
  const decided = exp ? progress.verdictChoices[exp.id] : undefined;

  function tap(value: 'did' | 'didnt') {
    if (!exp || !tonight) return;
    update((p) => ({
      ...p,
      taps: { ...p.taps, [exp.id]: { ...(p.taps[exp.id] ?? {}), [tonight.date]: { value } } },
    }));
    setNoted(true);
  }
  function leaveOut() {
    if (!exp || !lastNight || !reason) return;
    update((p) => ({
      ...p,
      taps: {
        ...p.taps,
        [exp.id]: { ...(p.taps[exp.id] ?? {}), [lastNight.date]: { value: own[lastNight.date]?.value ?? lastNight.tap, excluded: reason } },
      },
    }));
    setSheet(false);
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
  if (!ready || !source || exp === undefined)
    return (
      <section className="stack" aria-busy="true">
        <h1 className="sr-only">{copy.today.title}</h1>
        <Skeleton kind="line" />
        <Skeleton kind="title" />
        <Skeleton kind="option" count={2} />
      </section>
    );
  if (!exp)
    return (
      <section className="stack">
        <h1>{copy.today.emptyTitle}</h1>
        <p className="lede">{progress.dayOne.started ? copy.today.emptyLine : copy.today.notStartedLine}</p>
        <div className="actions-row">
          <ButtonLink href="/sorted" variant="ghost">
            {copy.today.seeDayOne}
          </ButtonLink>
        </div>
      </section>
    );
  if (decided)
    return (
      <section className="stack">
        <h1>{copy.today.emptyTitle}</h1>
        <p className="lede">{copy.today.nextLine('Alcohol in the evening')}</p>
      </section>
    );

  const condition = tonight?.condition ?? 'on';
  return (
    <section className="stack">
      <span className="label">{copy.today.dayOf(todayIndex + 1, exp.days, condition)}</span>
      <div className="glass today-card">
        <h1 className="line">{exp.instruction[condition]}</h1>
        {allTapped ? (
          <div className="stack-tight">
            <p>{copy.today.noted}</p>
            <h2 style={{ fontSize: 22 }}>{copy.today.verdictReady}</h2>
            <div className="actions-row">
              <ButtonLink href={`/verdicts/${exp.id}`}>{copy.today.readVerdict}</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="taps" role="group" aria-label={exp.instruction[condition]}>
            <Button onClick={() => tap('did')} autoFocus>
              {copy.today.didIt}
            </Button>
            <Button variant="ghost" onClick={() => tap('didnt')}>
              {copy.today.didnt}
            </Button>
          </div>
        )}
        {noted && !allTapped ? <p aria-live="polite">{copy.today.noted}</p> : null}
        {tappedToday ? <span className="sr-only">{copy.today.taps[tappedToday]}</span> : null}
      </div>
      <DayStrip nights={nights} today={todayIndex} onLabel={exp.instruction.on} offLabel={exp.instruction.off} />
      <p className="muted" style={{ fontSize: 14 }}>
        {copy.today.watching(exp.metric.toLowerCase())}
      </p>
      {lastNight ? (
        <div className="stack-tight">
          {own[lastNight.date]?.excluded ? (
            <p className="muted" style={{ fontSize: 14 }}>
              {copy.today.leftOut}
            </p>
          ) : (
            <Button variant="link" size="sm" onClick={() => setSheet((s) => !s)} aria-expanded={sheet}>
              {copy.today.dontCount}
            </Button>
          )}
          {sheet ? (
            <div className="glass sheet" role="group" aria-label={copy.today.leaveOutTitle}>
              <h2 style={{ fontSize: 20 }}>{copy.today.leaveOutTitle}</h2>
              <div className="chips" role="radiogroup" aria-label={copy.today.leaveOutTitle}>
                {copy.today.reasons.map((r) => (
                  <Chip key={r} radio selected={reason === r} onClick={() => setReason(r)}>
                    {r}
                  </Chip>
                ))}
              </div>
              <div className="actions-row">
                <Button size="sm" onClick={leaveOut} disabled={!reason}>
                  {copy.today.leaveOut}
                </Button>
                <Button variant="link" size="sm" onClick={() => setSheet(false)}>
                  {copy.today.keepIn}
                </Button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
      {progress.dataSource === 'demo' ? (
        <p className="notice" style={{ fontSize: 14 }}>
          {copy.today.demoNote}
        </p>
      ) : null}
    </section>
  );
}
