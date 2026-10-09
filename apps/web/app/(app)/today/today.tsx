'use client';

import { useEffect, useMemo, useState } from 'react';
import { DayStrip } from '../../../components/day-strip';
import { Button, ButtonLink, Chip, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { nightsWithTaps } from '../../../lib/data/demo';
import type { Experiment, Night } from '../../../lib/data/types';
import { useDataSource } from '../../../lib/data/use-source';
import { useProgress } from '../../../lib/progress/context';
import { api } from '../../../lib/api';

/** One instruction line, two buttons, and the fortnight so far. */
export function Today({ loadTemplates }: { loadTemplates?: Parameters<typeof useDataSource>[1] }) {
  const { ready, progress, update } = useProgress();
  const { source, failed, retry } = useDataSource(progress, loadTemplates);
  const [exp, setExp] = useState<Experiment | null | undefined>(undefined);
  const [noted, setNoted] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !source) return;
    let alive = true;
    source.experiments(progress).then((list) => alive && setExp(list[0] ?? null));
    return () => {
      alive = false;
    };
  }, [ready, source, progress]);

  const nights: Night[] = useMemo(
    () => (exp ? (exp.nights ?? nightsWithTaps(exp, progress)) : []),
    [exp, progress],
  );
  const todayIndex = exp?.through
    ? nights.findLastIndex((n) => n.date <= exp.through!)
    : exp
      ? exp.days - 1
      : 0;
  const tonight = nights[todayIndex];
  const lastNight = nights[todayIndex - 1];
  const own = exp ? (progress.taps[exp.id] ?? {}) : {};
  const tappedToday = tonight
    ? (own[tonight.date]?.value ?? (tonight.tap === 'unknown' ? undefined : tonight.tap))
    : undefined;
  const allTapped = exp?.through
    ? exp.status === 'done'
    : exp
      ? nights.every((n, i) => (i < todayIndex ? true : Boolean(own[n.date])))
      : false;
  const decided = exp ? progress.verdictChoices[exp.id] : undefined;

  async function action(path: string, data: unknown = {}) {
    if (!exp) return;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/app/experiments/${exp.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      update((p) => ({ ...p }));
    } catch {
      setError('Your change could not be saved. Please retry.');
    } finally {
      setSaving(false);
    }
  }
  async function tap(value: 'did' | 'didnt') {
    if (!exp || !tonight) return;
    if (exp.through) {
      await action('check-in', {
        sleepDate: tonight.date,
        tap: value,
        ...(exp.observeOnly ? { exposure: value === 'did' ? 'on' : 'off' } : {}),
      });
      return;
    }
    update((p) => ({
      ...p,
      taps: { ...p.taps, [exp.id]: { ...(p.taps[exp.id] ?? {}), [tonight.date]: { value } } },
    }));
    setNoted(true);
  }
  async function leaveOut() {
    if (!exp || !lastNight || !reason) return;
    if (exp.through) {
      const flags = ['ill', 'travelling', 'kids_woke_me', 'unusually_hard_session'];
      const index = copy.today.reasons.findIndex((r) => r === reason);
      if (index < 0 || index >= flags.length) {
        setError('Choose one of the recorded exclusion reasons.');
        return;
      }
      const tap = own[lastNight.date]?.value ?? lastNight.tap;
      await action('check-in', {
        sleepDate: lastNight.date,
        ...(tap !== 'unknown' ? { tap } : {}),
        exclusions: [flags[index]],
      });
      setSheet(false);
      return;
    }
    update((p) => ({
      ...p,
      taps: {
        ...p.taps,
        [exp.id]: {
          ...(p.taps[exp.id] ?? {}),
          [lastNight.date]: {
            value: own[lastNight.date]?.value ?? lastNight.tap,
            excluded: reason,
          },
        },
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
        <p className="lede">
          {progress.dayOne.started ? copy.today.emptyLine : copy.today.notStartedLine}
        </p>
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
        <p className="lede">
          {exp?.through
            ? 'Return to your audit to choose another resolved item.'
            : copy.today.nextLine('Alcohol in the evening')}
        </p>
        <ButtonLink href="/sorted" variant="ghost">
          {copy.today.seeDayOne}
        </ButtonLink>
      </section>
    );

  const condition = tonight?.condition ?? 'on';
  return (
    <section className="stack">
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      {exp.instructionForToday ? <p className="notice">Today: {exp.instructionForToday}</p> : null}
      <span className="label">
        {exp.observeOnly
          ? `Observation day ${Math.max(0, todayIndex + 1)} of ${exp.days}`
          : copy.today.dayOf(todayIndex + 1, exp.days, condition)}
      </span>
      <div className="glass today-card">
        <h1 className="line">
          {exp.observeOnly && exp.through
            ? 'Keep your usual routine. Did the observed condition happen?'
            : exp.instruction[condition]}
        </h1>
        {tonight && exp.through ? (
          <p className="muted">Morning check-in for {tonight.date}</p>
        ) : null}
        {exp.observeOnly && exp.through ? (
          <p>
            {exp.instruction.on} / {exp.instruction.off}
          </p>
        ) : null}
        {exp.decision?.status === 'extend' && (allTapped || tappedToday) ? (
          <div className="stack-tight">
            <p>{copy.today.noted}</p>
            <h2 style={{ fontSize: 22 }}>{copy.today.extendTitle}</h2>
            <p className="muted">{copy.today.extendLine(exp.decision.nextLook ? (exp.maxDays ?? exp.days) : exp.days)}</p>
            {!exp.through && exp.synthetic ? (
              <div className="actions-row">
                <Button
                  variant="ghost"
                  onClick={() =>
                    update((p) => ({ ...p, demoSkipDays: Math.min(2, (p.demoSkipDays ?? 0) + 1) }))
                  }
                >
                  {copy.today.skipWeek}
                </Button>
              </div>
            ) : null}
          </div>
        ) : allTapped ? (
          <div className="stack-tight">
            <p>{copy.today.noted}</p>
            <h2 style={{ fontSize: 22 }}>{copy.today.verdictReady}</h2>
            <div className="actions-row">
              <ButtonLink href={`/verdicts/${exp.id}`}>{copy.today.readVerdict}</ButtonLink>
            </div>
          </div>
        ) : exp.canFinish ? (
          <div className="actions-row">
            <Button disabled={saving} onClick={() => void action('finish')}>
              Calculate and save verdict
            </Button>
          </div>
        ) : todayIndex < 0 ? (
          <p>
            Your test starts on {exp.startDate}. Your first morning check-in appears after that
            night.
          </p>
        ) : (
          <div className="taps" role="group" aria-label={exp.instruction[condition]}>
            <Button onClick={() => void tap('did')} disabled={saving} autoFocus>
              {copy.today.didIt}
            </Button>
            <Button variant="ghost" onClick={() => void tap('didnt')} disabled={saving}>
              {copy.today.didnt}
            </Button>
          </div>
        )}
        {noted && !allTapped ? <p aria-live="polite">{copy.today.noted}</p> : null}
        {tappedToday ? <span className="sr-only">{copy.today.taps[tappedToday]}</span> : null}
      </div>
      <DayStrip
        nights={nights}
        today={todayIndex}
        onLabel={exp.instruction.on}
        offLabel={exp.instruction.off}
      />
      <p className="muted" style={{ fontSize: 14 }}>
        {copy.today.watching(exp.metric.toLowerCase())}
      </p>
      {exp.decision?.status === 'in_progress' && exp.decision.nextLook ? (
        <p className="muted" style={{ fontSize: 14 }}>
          {copy.today.firstReadLine(exp.decision.nextLook)}
        </p>
      ) : null}
      {lastNight ? (
        <div className="stack-tight">
          {own[lastNight.date]?.excluded ? (
            <p className="muted" style={{ fontSize: 14 }}>
              {copy.today.leftOut}
            </p>
          ) : (
            <Button
              variant="link"
              size="sm"
              onClick={() => setSheet((s) => !s)}
              aria-expanded={sheet}
            >
              {copy.today.dontCount}
            </Button>
          )}
          {sheet ? (
            <div className="glass sheet" role="group" aria-label={copy.today.leaveOutTitle}>
              <h2 style={{ fontSize: 20 }}>{copy.today.leaveOutTitle}</h2>
              <div className="chips" role="radiogroup" aria-label={copy.today.leaveOutTitle}>
                {copy.today.reasons
                  .filter((r) => !exp.through || r !== 'Something else')
                  .map((r) => (
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
      {exp.through && exp.synthetic && exp.status !== 'done' ? (
        <div className="stack-tight">
          <p className="notice">
            Synthetic demo measurements. Advancing the demo does not change any real wearable data.
          </p>
          <div className="actions-row">
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => void action('advance-demo', { all: false })}
            >
              Next demo morning
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => void action('advance-demo', { all: true })}
            >
              Simulate remaining demo nights
            </Button>
          </div>
        </div>
      ) : null}
      {exp.through && exp.status !== 'done' ? (
        <Button variant="link" disabled={saving} onClick={() => void action('cancel')}>
          Cancel this test
        </Button>
      ) : null}
      {progress.dataSource === 'demo' && !exp.through ? (
        <p className="notice" style={{ fontSize: 14 }}>
          {copy.today.demoNote(exp.days)}
        </p>
      ) : null}
    </section>
  );
}
