'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import { Sheet, Toggle } from '../../../components/ds/sheet';
import { Icon } from '../../../components/ds/icons';
import { Arrow, Mark } from '../../../components/ds/ui';
import { copy } from '../../../lib/copy';
import { supabaseConfigured } from '../../../lib/env';
import { engineApi } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { useProgress } from '../../../lib/progress/context';
import { LocalProgressStore } from '../../../lib/progress/local';
import { deleteEverything, signOut } from './actions';

const t = copy.settingsTab;
const s = copy.settings;
const motionKey = 'distill.motion';

function Row({ title, line, right, onClick, href, danger }: { title: string; line?: string; right?: ReactNode; onClick?: () => void; href?: string; danger?: boolean }) {
  const body = (
    <>
      <div>
        <strong>{title}</strong>
        {line ? <p>{line}</p> : null}
      </div>
      {right ?? <Icon name="arrow" className="ds-icon st-chevron" />}
    </>
  );
  const cls = `st-row${danger ? ' st-row--danger' : ''}`;
  if (href)
    return (
      <Link className={cls} href={href}>
        {body}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" className={cls} onClick={onClick}>
        {body}
      </button>
    );
  return <div className={cls}>{body}</div>;
}

/**
 * Settings: their account, gentle messages (not built yet), whether their nights shape their
 * mornings, their wearable, what Distill knows, their data, less motion, and signing out.
 */
export function SettingsTab({
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
  const [less, setLess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    try {
      setLess(localStorage.getItem(motionKey) === 'reduce');
    } catch {
      // Storage can be blocked; motion just follows the system.
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

  const name = progress.name.trim();
  const source = progress.dataSource ? s.sourceNames[progress.dataSource] : null;
  const since = progress.connectedAt ? new Date(progress.connectedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
  const signedIn = engine.on || !!email;

  return (
    <main className="tb-page">
      <header className="tb-header">
        <div>
          <span>{t.eyebrow}</span>
          <h1>{t.title}</h1>
        </div>
        <Mark />
      </header>
      {error ? (
        <p className="ds-notice" role="alert">
          {error}
        </p>
      ) : null}

      <section className="st-profile" aria-label={t.account}>
        <span className="st-profile-letter" aria-hidden="true">
          {(name || 'D').charAt(0).toUpperCase()}
        </span>
        <div style={{ flex: 1 }}>
          <strong>{name || t.guest}</strong>
          <p>{email ?? (ready && !signedIn ? t.signedOutLine : '')}</p>
        </div>
      </section>
      {ready && !signedIn && supabaseConfigured ? (
        <Link className="ds-primary" href="/sign-in" style={{ marginTop: 10 }}>
          {t.signIn}
          <Arrow />
        </Link>
      ) : null}

      <section className="st-group" aria-labelledby="st-rhythm">
        <h2 id="st-rhythm">{t.rhythm}</h2>
        <Row title={t.gentle} line={t.gentleLine} right={<span className="st-soon">{t.soon}</span>} />
        {engine.on && engine.state ? (
          <div className="st-row">
            <div>
              <strong id="st-nights">{s.nightsTitle}</strong>
              <p>{progress.dataSource ? s.nightsLine : s.nightsNeedsSource}</p>
            </div>
            <Toggle
              on={nights}
              labelledBy="st-nights"
              disabled={engine.busy || !progress.dataSource}
              onChange={(on) => void engine.act(() => engineApi.settings(on))}
            />
          </div>
        ) : null}
        <Row
          title={t.wearable}
          line={source ? `${source} · ${s.since(since)}` : t.wearableNone}
          right={source ? <button type="button" className="ds-link ds-link--quiet" onClick={() => setConfirm('disconnect')}>{progress.dataSource === 'demo' ? s.disconnect : 'Reset onboarding'}</button> : undefined}
          href={source ? undefined : '/connect'}
        />
      </section>

      <section className="st-group" aria-labelledby="st-privacy">
        <h2 id="st-privacy">{t.privacy}</h2>
        <Row title={t.knows} line={t.knowsLine} href="/things#knows" />
        <Row title={t.data} line={t.dataLine} onClick={exportData} />
        <Row title={t.policy} line={t.policyLine} href="/privacy" />
        <Row title={t.help} line={t.helpLine} href="/support" />
        <div className="st-row">
          <div>
            <strong id="st-motion">{s.lessMotion}</strong>
            <p>{s.lessMotionHint}</p>
          </div>
          <Toggle on={less} labelledBy="st-motion" onChange={setMotion} />
        </div>
        <Row title={s.deleteAll} danger onClick={() => setConfirm('delete')} />
      </section>

      <section className="st-privacy">
        <Mark size="sm" />
        <p>{t.note}</p>
      </section>

      {supabaseConfigured && signedIn ? (
        <div style={{ marginTop: 18 }}>
          <button type="button" className="ds-link" style={{ paddingLeft: 0 }} onClick={async () => {
              // The copy of their Ritual kept on this phone goes too, so the next person sees nothing of it.
              await new LocalProgressStore().clear();
              await onSignOut();
            }}>
            {s.signOut}
          </button>
        </div>
      ) : null}
      <p className="st-legal">{s.counting}</p>
      <p className="st-legal">{copy.common.disclaimer}</p>

      {confirm === 'delete' ? (
        <Sheet title={s.deleteTitle} closeLabel={s.keepAccount} onClose={() => setConfirm(null)}>
          <div className="st-confirm" style={{ marginTop: 12 }}>
            <p>{s.deleteLine}</p>
            <button type="button" className="ds-primary" onClick={() => void doDelete()}>
              {s.deleteAll}
            </button>
            <button type="button" className="ds-secondary" onClick={() => setConfirm(null)}>
              {s.keepAccount}
            </button>
          </div>
        </Sheet>
      ) : null}
      {confirm === 'disconnect' ? (
        <Sheet title={s.disconnectTitle} closeLabel={s.keepIt} onClose={() => setConfirm(null)}>
          <div className="st-confirm" style={{ marginTop: 12 }}>
            <p>{s.disconnectLine}</p>
            <button type="button" className="ds-primary" onClick={() => void disconnect()}>
              {s.disconnect}
            </button>
            <button type="button" className="ds-secondary" onClick={() => setConfirm(null)}>
              {s.keepIt}
            </button>
          </div>
        </Sheet>
      ) : null}
    </main>
  );
}
