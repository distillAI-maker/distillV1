'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Dialog } from '../../../components/dialog';
import { Button, ButtonLink } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { supabaseConfigured } from '../../../lib/env';
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

  return (
    <section className="stack">
      <h1>{copy.settings.title}</h1>
      {error ? (
        <p className="notice" role="alert">
          {error}
        </p>
      ) : null}
      {gone ? <p className="notice">{copy.settings.deleted}</p> : null}

      <section className="stack-tight" aria-labelledby="s-src">
        <h2 id="s-src" style={{ fontSize: 22 }}>
          {copy.settings.sourcesTitle}
        </h2>
        {ready && sourceName ? (
          <div className="srow">
            <span>
              {sourceName}
              <span className="hint" style={{ display: 'block' }}>
                {copy.settings.since(since)}
              </span>
            </span>
            <Button variant="ghost" size="sm" onClick={() => setConfirm('disconnect')}>
              {progress.dataSource === 'demo' ? copy.settings.disconnect : 'Reset onboarding'}
            </Button>
          </div>
        ) : (
          <p className="muted">{copy.settings.noSource}</p>
        )}
        <div>
          <ButtonLink href="/connect" variant="ghost" size="sm">
            {copy.settings.addSource}
          </ButtonLink>
        </div>
      </section>

      <section className="stack-tight" aria-labelledby="s-data">
        <h2 id="s-data" style={{ fontSize: 22 }}>
          {copy.settings.dataTitle}
        </h2>
        <div className="srow">
          <span>
            {copy.settings.exportData}
            <span className="hint" style={{ display: 'block' }}>
              {copy.settings.exportHint}
            </span>
          </span>
          <Button variant="ghost" size="sm" onClick={exportData}>
            {copy.settings.exportData}
          </Button>
        </div>
        <div className="srow">
          <span>{copy.settings.deleteAll}</span>
          <Button variant="ghost" size="sm" onClick={() => setConfirm('delete')}>
            {copy.settings.deleteAll}
          </Button>
        </div>
      </section>

      <section className="stack-tight" aria-labelledby="s-disp">
        <h2 id="s-disp" style={{ fontSize: 22 }}>
          {copy.settings.displayTitle}
        </h2>
        <div className="srow">
          <span id="s-motion">
            {copy.settings.lessMotion}
            <span className="hint" style={{ display: 'block' }}>
              {copy.settings.lessMotionHint}
            </span>
          </span>
          <button
            type="button"
            className="switch-btn"
            role="switch"
            aria-checked={less}
            aria-labelledby="s-motion"
            onClick={() => setMotion(!less)}
          />
        </div>
      </section>

      <section className="stack-tight" aria-labelledby="s-acc">
        <h2 id="s-acc" style={{ fontSize: 22 }}>
          {copy.settings.accountTitle}
        </h2>
        {supabaseConfigured ? (
          <div className="srow">
            <span>{email}</span>
            <Button variant="ghost" size="sm" onClick={() => onSignOut()}>
              {copy.settings.signOut}
            </Button>
          </div>
        ) : (
          <p className="muted">{copy.common.savedOnDevice}</p>
        )}
      </section>

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
    </section>
  );
}
