'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Icon } from '../../../components/icon';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { env } from '../../../lib/env';
import { useProgress } from '../../../lib/progress/context';
import type { DataSourceId } from '../../../lib/progress/types';

/** Six months of demo nights. The number counts up as the bar fills. */
export const demoNights = 183;
const demoBackfillMs = 2000;

type Phase = 'pick' | 'backfill' | 'done' | 'error';

const live: { id: DataSourceId; label: string }[] = [
  { id: 'oura', label: copy.connect.oura },
  { id: 'whoop', label: copy.connect.whoop },
  { id: 'fitbit', label: copy.connect.fitbit },
];

function motionOff(): boolean {
  if (typeof window === 'undefined') return true;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--motion').trim();
  return v === '0';
}

export function ConnectForm() {
  const router = useRouter();
  const { ready, progress, update } = useProgress();
  const [phase, setPhase] = useState<Phase>('pick');
  const [nights, setNights] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const frame = useRef<number | null>(null);

  // A reload during or after the demo backfill lands on the finished state, not the start.
  useEffect(() => {
    if (ready && progress.dataSource === 'demo' && progress.backfill?.done) {
      setNights(progress.backfill.nights);
      setPhase('done');
    }
  }, [ready, progress.dataSource, progress.backfill]);

  useEffect(() => () => void (frame.current && cancelAnimationFrame(frame.current)), []);

  function finish(n: number) {
    setNights(n);
    setPhase('done');
    update({ dataSource: 'demo', backfill: { nights: n, done: true } });
  }

  function startDemo() {
    update({ dataSource: 'demo', backfill: { nights: 0, done: false } });
    if (motionOff()) return finish(demoNights);
    setPhase('backfill');
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / demoBackfillMs);
      const eased = 1 - Math.pow(1 - k, 3);
      setNights(Math.round(eased * demoNights));
      if (k < 1) frame.current = requestAnimationFrame(tick);
      else finish(demoNights);
    };
    frame.current = requestAnimationFrame(tick);
  }

  async function startLive(id: DataSourceId) {
    setBusy(id);
    try {
      const res = await fetch(`/api/providers/${id}/connect`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });
      if (!res.ok) throw new Error(String(res.status));
      const { authorizationUrl } = (await res.json()) as { authorizationUrl?: string };
      if (!authorizationUrl) throw new Error('no url');
      update({ dataSource: id });
      window.location.assign(authorizationUrl);
    } catch {
      setBusy(null);
      setPhase('error');
    }
  }

  function next() {
    update({ step: 'stack' });
    router.push('/stack');
  }

  if (!ready) {
    return (
      <section className="stack" aria-busy="true">
        <h1>{copy.connect.title}</h1>
        <p className="lede">{copy.connect.line}</p>
        <Skeleton kind="option" count={5} />
      </section>
    );
  }

  if (phase === 'backfill' || phase === 'done') {
    const pct = Math.round((nights / demoNights) * 100);
    const done = phase === 'done';
    return (
      <section className="stack" aria-live="polite">
        <h2>{copy.connect.backfillTitle}</h2>
        <p className="lede mono">{done ? copy.connect.backfillDone : copy.connect.backfillCount(nights)}</p>
        <div
          className="bar"
          role="progressbar"
          aria-label={copy.connect.backfillTitle}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <i style={{ '--w': `${pct}%` } as CSSProperties} />
        </div>
        {done ? (
          <div className="actions">
            <Button onClick={next} autoFocus>
              {copy.common.continue}
            </Button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>{copy.connect.title}</h1>
      <p className="lede">{copy.connect.line}</p>
      {phase === 'error' ? (
        <p className="notice" role="alert">
          {copy.connect.errorStart}
        </p>
      ) : null}
      <ul className="options" aria-label={copy.connect.title}>
        {live.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="option"
              disabled={!env.providersEnabled}
              aria-describedby={env.providersEnabled ? undefined : 'connect-unavailable'}
              onClick={() => startLive(p.id)}
              aria-busy={busy === p.id || undefined}
            >
              <Icon name="watch" />
              <span>
                <b>{p.label}</b>
              </span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            className="option"
            disabled={!env.providersEnabled}
            aria-describedby={env.providersEnabled ? undefined : 'connect-unavailable'}
            onClick={() => router.push('/connect/apple')}
          >
            <Icon name="heart" />
            <span>
              <b>{copy.connect.apple}</b>
              <small>{copy.connect.appleHint}</small>
            </span>
          </button>
        </li>
        <li>
          <button type="button" className="option option-primary" onClick={startDemo}>
            <Icon name="spark" />
            <span>
              <b>{copy.connect.demo}</b>
              <small>{copy.connect.demoLine}</small>
            </span>
          </button>
        </li>
      </ul>
      {!env.providersEnabled ? (
        <p className="muted" id="connect-unavailable" style={{ fontSize: 14 }}>
          {copy.connect.unavailable}
        </p>
      ) : null}
    </section>
  );
}
