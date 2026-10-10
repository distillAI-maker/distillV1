'use client';
import { api } from '../../../lib/api';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Icon } from '../../../components/icon';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { env } from '../../../lib/env';
import { FirstReading } from './first-reading';
import { useProgress } from '../../../lib/progress/context';
import type { DataSourceId } from '../../../lib/progress/types';

/** Six months of demo nights. The number counts up as the bar fills. */
export const demoNights = 183;
const demoBackfillMs = 2000;

type Phase = 'pick' | 'backfill' | 'done' | 'error';

const live: { id: DataSourceId; label: string }[] = [
  { id: 'oura', label: copy.connect.oura },
  { id: 'whoop', label: copy.connect.whoop },
];

function motionOff(): boolean {
  if (typeof window === 'undefined') return true;
  const v = getComputedStyle(document.documentElement).getPropertyValue('--motion').trim();
  return v === '0';
}

export function ConnectForm() {
  const router = useRouter();
  const { ready, progress, update, saveNow, store } = useProgress();
  const [liveMessage, setLiveMessage] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>('pick');
  const [nights, setNights] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const frame = useRef<number | null>(null);

  // A reload after the backfill, or a finished import, lands on the finished state, not the start.
  useEffect(() => {
    if (ready && progress.dataSource && progress.backfill?.done) {
      setNights(progress.dataSource === 'demo' ? progress.backfill.nights : demoNights);
      setPhase('done');
    }
  }, [ready, progress.dataSource, progress.backfill]);

  useEffect(() => () => void (frame.current && cancelAnimationFrame(frame.current)), []);

  function finish(n: number) {
    setNights(n);
    setPhase('done');
    update({
      dataSource: 'demo',
      connectedAt: new Date().toISOString(),
      backfill: { nights: n, done: true },
    });
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
      const { authorizationUrl } = await api<{ authorizationUrl?: string }>(
        `/api/providers/${id}/connect`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: '{}',
        },
      );
      if (!authorizationUrl) throw new Error('no url');
      const next = {
        ...progress,
        dataSource: id,
        connectedAt: new Date().toISOString(),
        backfill: { nights: 0, done: false },
      };
      await saveNow(next);
      update(next);
      window.location.assign(authorizationUrl);
    } catch {
      setBusy(null);
      setPhase('error');
    }
  }

  async function checkLive() {
    setBusy('status');
    try {
      const status = await api<{
        connections: {
          provider: string;
          disabled: boolean;
          errorCode: string | null;
          backfillBefore: string | null;
        }[];
      }>('/api/providers');
      const connection = status.connections.find((c) => c.provider === progress.dataSource);
      if (!connection || connection.disabled || connection.errorCode) {
        setLiveMessage('The connection needs attention. Reconnect or import a file.');
        return;
      }
      if (connection.backfillBefore) {
        await api('/api/sync', { method: 'POST', body: '{}' });
        setLiveMessage('History is still syncing. Check again shortly.');
        return;
      }
      // Connect is the last onboarding step: once history is in, the first reading is set up here.
      const next = { ...progress, backfill: { nights: 0, done: true } };
      await saveNow(next);
      update(next);
      setNights(demoNights);
      setPhase('done');
    } catch {
      setLiveMessage('Connection status could not be loaded. Please retry.');
    } finally {
      setBusy(null);
    }
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
        <p className="lede mono">
          {done ? copy.connect.backfillDone : copy.connect.backfillCount(nights)}
        </p>
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
        {done ? <FirstReading /> : null}
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>{copy.connect.title}</h1>
      <p className="lede">{copy.connect.line}</p>
      {store.id === 'supabase' &&
      progress.dataSource &&
      ['oura', 'whoop', 'fitbit'].includes(progress.dataSource) ? (
        <div className="stack-tight">
          <Button variant="ghost" disabled={Boolean(busy)} onClick={() => void checkLive()}>
            Check connection and continue
          </Button>
          {liveMessage ? (
            <p className="notice" role="status">
              {liveMessage}
            </p>
          ) : null}
        </div>
      ) : null}
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
          <button type="button" className="option" onClick={() => router.push('/connect/import')}>
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
