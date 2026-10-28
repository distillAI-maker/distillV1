'use client';
import { api } from '../../../lib/api';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { RitualToken } from '../../../components/ds/ritual-token';
import { Arrow, Mark } from '../../../components/ds/ui';
import { copy } from '../../../lib/copy';
import { env } from '../../../lib/env';
import { RITUAL_HOME } from '../../../lib/steps';
import { useProgress } from '../../../lib/progress/context';
import { track } from '../../../lib/track';
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
  const [settling, setSettling] = useState(false);
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

  /** Onboarding ends here: the Ritual they accepted settles into its tab, and the app opens on it. */
  function openRitual() {
    if (!progress.dataSource) track('no_wearable');
    setSettling(true);
    const next = { ...progress, step: 'done' as const, updatedAt: new Date().toISOString() };
    const saved = saveNow(next).catch(() => undefined);
    const settled = new Promise((r) => setTimeout(r, motionOff() ? 0 : 850));
    void Promise.all([saved, settled]).finally(() => {
      update(next);
      router.push(RITUAL_HOME);
    });
  }

  function startDemo() {
    track('wearable', { source: 'demo' });
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
      <div className="ob-content" aria-busy="true">
        <header className="ob-heading">
          <h1>{copy.connect.title}</h1>
          <p>{copy.connect.line}</p>
        </header>
        <div className="ob-wait">
          <i />
          <i />
        </div>
      </div>
    );
  }

  if (phase === 'backfill' || phase === 'done') {
    const done = phase === 'done';
    return (
      <section className="ng-reading" aria-live="polite">
        <RitualToken settling={settling} />
        <Mark />
        <h1>{done ? copy.connect.backfillDone : nights ? copy.connect.backfillCount(nights) : copy.connect.backfillTitle}</h1>
        <div className={`ng-wave${done ? ' is-done' : ''}`} aria-hidden="true">
          {Array.from({ length: 18 }, (_, i) => (
            <i key={i} />
          ))}
        </div>
        {done ? (
          <button type="button" className="ds-primary" onClick={openRitual}>
            {copy.connect.open}
            <Arrow />
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <div className="ob-content">
      <RitualToken settling={settling} />
      <header className="ob-heading">
        <h1>{copy.connect.title}</h1>
        <p>{copy.connect.line}</p>
      </header>
      {store.id === 'supabase' &&
      progress.dataSource &&
      ['oura', 'whoop', 'fitbit'].includes(progress.dataSource) ? (
        <div style={{ marginBottom: 16 }}>
          <button type="button" className="ds-secondary" disabled={Boolean(busy)} onClick={() => void checkLive()}>
            Check connection and continue
          </button>
          {liveMessage ? (
            <p className="ds-notice" role="status">
              {liveMessage}
            </p>
          ) : null}
        </div>
      ) : null}
      {phase === 'error' ? (
        <p className="ds-notice" role="alert">
          {copy.connect.errorStart}
        </p>
      ) : null}
      <ul className="ng-options" aria-label={copy.connect.title}>
        {live.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              className="ng-option"
              disabled={!env.providersEnabled}
              aria-describedby={env.providersEnabled ? undefined : 'connect-unavailable'}
              onClick={() => startLive(p.id)}
              aria-busy={busy === p.id || undefined}
            >
              <strong>{p.label}</strong>
            </button>
          </li>
        ))}
        <li>
          <button type="button" className="ng-option" onClick={() => router.push('/connect/import')}>
            <strong>{copy.connect.apple}</strong>
            <span>{copy.connect.appleHint}</span>
          </button>
        </li>
        <li>
          <button type="button" className="ng-option" onClick={startDemo}>
            <strong>{copy.connect.demo}</strong>
            <span>{copy.connect.demoLine}</span>
          </button>
        </li>
      </ul>
      {!env.providersEnabled ? (
        <p className="rv-note" id="connect-unavailable">
          {copy.connect.unavailable}
        </p>
      ) : null}
      {/* Most people don't own a wearable: the app works without one, and they can connect later. */}
      <div className="ob-other" style={{ marginTop: 28 }}>
        <button type="button" className="ds-link" onClick={openRitual}>
          {copy.connect.without}
        </button>
      </div>
    </div>
  );
}
