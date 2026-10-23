'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Dialog } from '../../../components/dialog';
import Link from 'next/link';
import { Button } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { supabaseConfigured } from '../../../lib/env';
import { engineApi } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { useProgress } from '../../../lib/progress/context';
import { deleteEverything, signOut } from './actions';

const motionKey = 'distill.motion';

export function SettingsView({
  email,
  onDelete = deleteEverything,
  onSignOut = signOut,
}: {
  email?: string | null;
  onDelete?: typeof deleteEverything;
  onSignOut?: typeof signOut;
}) {
  const router = useRouter();
  const { ready, progress, update, reset } = useProgress();
  const engine = useEngine();
  const nights = engine.state?.person.nightsShapeMornings ?? false;
  const [confirm, setConfirm] = useState<'delete' | 'disconnect' | null>(null);
  const [gone, setGone] = useState(false);
  const [less, setLess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      setLess(localStorage.getItem(motionKey) === 'reduce');
    } catch {
      // ignore
    }
  }, []);

  function setMotion(on: boolean) {
    setLess(on);
    try {
      if (on) localStorage.setItem(motionKey, 'reduce');
      else localStorage.removeItem(motionKey);
    } catch {
      // ignore
    }
    if (on) document.documentElement.dataset.motion = 'reduce';
    else delete document.documentElement.dataset.motion;
    update({ reducedMotion: on });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(progress, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `distill-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function doDelete() {
    const result = await onDelete();
    if (result.status === 'failed') {
      setError('Your account could not be deleted. Please retry.');
      return;
    }
    await reset(result.status === 'deleted');
    setConfirm(null);
    setGone(true);
    router.push('/');
  }
  async function disconnect() {
    try {
      await reset();
      setConfirm(null);
      router.push('/connect');
    } catch {
      setError('Finish or cancel your active test before resetting progress.');
    }
  }

  const sourceName = progress.dataSource ? copy.settings.sourceNames[progress.dataSource] : null;
  const sinceDate = progress.connectedAt ?? progress.updatedAt;
  const since = sinceDate
    ? new Date(sinceDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    : '';

  const chevron = (
    <svg className="d-settings-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden="true">
      <path d="M9 5l7 7-7 7" />
    </svg>
  );
  const toggle = (on: boolean, labelledBy: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      className={`d-toggle${on ? ' d-toggle--on' : ''}`}
      role="switch"
      aria-checked={on}
      aria-labelledby={labelledBy}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="d-toggle__thumb" />
    </button>
  );

  return (
    <div className="d-tab-content d-settings-tab">
      <h1 className="d-sr">{copy.settings.title}</h1>
      {error ? (
        <p className="d-notice" role="alert">
          {error}
        </p>
      ) : null}
      {gone ? <p className="d-notice">{copy.settings.deleted}</p> : null}

      <section className="d-settings-section" aria-labelledby="s-src">
        <h2 id="s-src" className="d-settings-label">
          {copy.settings.sourcesTitle}
        </h2>
        <div className="d-settings-items">
          {ready && sourceName ? (
            <div className="d-settings-row">
              <span className="d-settings-row__left">
                <span className="d-source-dot d-source-dot--on" />
                <span className="d-settings-row__label">
                  <span>{sourceName}</span>
                  <span className="d-settings-row__sub">{copy.settings.since(since)}</span>
                </span>
              </span>
              <button type="button" className="d-source-btn" onClick={() => setConfirm('disconnect')}>
                {progress.dataSource === 'demo' ? copy.settings.disconnect : 'Reset onboarding'}
              </button>
            </div>
          ) : (
            <p className="d-settings-hint">{copy.settings.noSource}</p>
          )}
          <Link className="d-settings-row" href="/connect">
            <span className="d-settings-row__left">
              <span className="d-source-dot" />
              <span className="d-settings-row__label">{copy.settings.addSource}</span>
            </span>
            <span className="d-source-btn">{copy.app.settings.connect}</span>
          </Link>
        </div>
      </section>

      {engine.on && engine.state ? (
        <section className="d-settings-section" aria-label={copy.days.title}>
          <div className="d-settings-row">
            <span className="d-settings-row__left">
              <span id="s-nights" className="d-settings-row__label">
                {copy.settings.nightsTitle}
              </span>
            </span>
            {toggle(nights, 's-nights', () => void engine.act(() => engineApi.settings(!nights)), engine.busy || !progress.dataSource)}
          </div>
          <p className="d-settings-hint">{progress.dataSource ? copy.settings.nightsLine : copy.settings.nightsNeedsSource}</p>
        </section>
      ) : null}

      <section className="d-settings-section" aria-label={copy.settings.dataTitle}>
        <div className="d-settings-items">
          <button type="button" className="d-settings-row d-settings-row--btn" onClick={exportData}>
            <span className="d-settings-row__label">{copy.settings.exportData}</span>
            {chevron}
          </button>
          <Link className="d-settings-row d-settings-row--btn" href="/home/you">
            <span className="d-settings-row__label">{copy.settings.learned}</span>
            {chevron}
          </Link>
          <p className="d-settings-hint d-settings-hint--under">{copy.settings.learnedHint}</p>
          <div className="d-settings-row">
            <span className="d-settings-row__left">
              <span id="s-motion" className="d-settings-row__label">
                {copy.settings.lessMotion}
              </span>
            </span>
            {toggle(less, 's-motion', () => setMotion(!less))}
          </div>
        </div>
      </section>

      <section className="d-settings-section d-settings-section--danger" aria-label={copy.settings.accountTitle}>
        <button type="button" className="d-settings-row d-settings-row--btn d-settings-row--danger" onClick={() => setConfirm('delete')}>
          <span className="d-settings-row__label">{copy.settings.deleteAll}</span>
          {chevron}
        </button>
        {supabaseConfigured ? (
          <button type="button" className="d-settings-row d-settings-row--btn" onClick={() => onSignOut()}>
            <span className="d-settings-row__label">
              <span>{copy.settings.signOut}</span>
              {email ? <span className="d-settings-row__sub">{email}</span> : null}
            </span>
            {chevron}
          </button>
        ) : (
          <p className="d-settings-hint">{copy.common.savedOnDevice}</p>
        )}
      </section>

      <p className="d-settings-version">Distill · 1.0</p>
      <p className="d-settings-legal">{copy.settings.counting}</p>
      <p className="d-settings-legal">{copy.common.disclaimer}</p>

      <Dialog
        open={confirm === 'delete'}
        onClose={() => setConfirm(null)}
        label={copy.settings.deleteTitle}
      >
        <h2 style={{ fontSize: 22 }}>{copy.settings.deleteTitle}</h2>
        <p>{copy.settings.deleteLine}</p>
        <div className="actions-row">
          <Button onClick={doDelete}>{copy.settings.deleteAll}</Button>
          <Button variant="ghost" onClick={() => setConfirm(null)} data-autofocus>
            {copy.settings.keepAccount}
          </Button>
        </div>
      </Dialog>
      <Dialog
        open={confirm === 'disconnect'}
        onClose={() => setConfirm(null)}
        label={copy.settings.disconnectTitle}
      >
        <h2 style={{ fontSize: 22 }}>{copy.settings.disconnectTitle}</h2>
        <p>{copy.settings.disconnectLine}</p>
        <div className="actions-row">
          <Button onClick={disconnect}>{copy.settings.disconnect}</Button>
          <Button variant="ghost" onClick={() => setConfirm(null)} data-autofocus>
            {copy.settings.keepIt}
          </Button>
        </div>
      </Dialog>
    </div>
  );
}
