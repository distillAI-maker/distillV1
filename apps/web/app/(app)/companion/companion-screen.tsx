'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { useRouted } from '../../../lib/data/use-routed';
import { engineApi } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { useProgress } from '../../../lib/progress/context';
import { newItemId, type Progress } from '../../../lib/progress/types';
import home from '../home/home.module.css';
import t from '../today/today.module.css';
import s from './companion.module.css';

/**
 * The companion thread: tell Distill what's coming up, and your days shape around it. A reply can
 * raise a follow-up, which is always theirs to confirm: a change to their list, or a feeling about
 * something on it.
 */
export function CompanionScreen() {
  const { ready, progress, update } = useProgress();
  const { on, state, act, busy, last, clearLast, error } = useEngine();
  const { routed } = useRouted();
  const [text, setText] = useState('');
  const end = useRef<HTMLLIElement | null>(null);
  const count = state?.thread.length ?? 0;

  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [count]);

  if (!ready) return <Skeleton kind="title" count={2} />;
  if (!on)
    return (
      <div className={home.page}>
        <h1 className={t.title}>{copy.companion.title}</h1>
        <p className={t.lede}>{copy.days.signedOut}</p>
        <Link className={`${home.primary} ${t.buttonLink}`} href="/sign-in">
          {copy.days.signIn}
        </Link>
      </div>
    );
  if (!state)
    return (
      <section className={home.page} aria-busy={!error}>
        {error ? (
          <p className="notice" role="alert">
            {copy.days.error}
          </p>
        ) : (
          <Skeleton kind="title" count={2} />
        )}
      </section>
    );

  const nameOf = (id: string | undefined) =>
    routed?.items.find((r) => r.stackItemId === id)?.name ??
    progress.items.find((i) => i.id === id)?.label ??
    progress.items.find((i) => i.id === id)?.customName ??
    '';

  async function send() {
    const message = text.trim().slice(0, 2000);
    if (!message) return;
    clearLast();
    if (await act(() => engineApi.message(message))) setText('');
  }

  /** They stopped something: it leaves their list, and the rules run again on what is left. */
  function takeOff(stackItemId: string) {
    const next: Progress = {
      ...progress,
      items: progress.items.map((i) => (i.id === stackItemId ? { ...i, status: 'cut' } : i)),
    };
    update(next);
    clearLast();
    void act(() => engineApi.run({ kind: 'stack-change' }), { save: next });
  }
  /** They started something new: it joins their list in their own words. */
  function addIt(name: string) {
    const next: Progress = {
      ...progress,
      items: [
        ...progress.items,
        {
          id: newItemId(),
          itemKey: null,
          customName: name.slice(0, 120),
          monthlyCost: 0,
          answers: {},
          chips: {},
          unknown: [],
          status: 'listed',
          notes: [],
          position: progress.items.length,
        },
      ],
    };
    update(next);
    clearLast();
    void act(() => engineApi.run({ kind: 'stack-change' }), { save: next });
  }

  const change = last?.stackChange;
  const asks = last?.ask ?? [];

  return (
    <div className={home.page}>
      <p className={home.dateLabel}>{copy.days.title}</p>
      <h1 className={t.title}>{copy.companion.title}</h1>
      <p className={t.lede}>{copy.companion.line}</p>

      {state.thread.length ? (
        <ol className={s.thread} aria-label={copy.companion.title}>
          {state.thread.map((m) => (
            <li key={m.id} className={m.role === 'person' ? s.person : s.companion}>
              <span className={home.eyebrow}>{m.role === 'person' ? copy.companion.you : copy.companion.distill}</span>
              <p>{m.text}</p>
              {m.ritualVersionId ? (
                <Link className={s.seeChange} href="/today">
                  {copy.companion.seeChange} →
                </Link>
              ) : null}
            </li>
          ))}
          <li ref={end} aria-hidden="true" className={s.end} />
        </ol>
      ) : (
        <p className={t.empty}>{copy.companion.empty}</p>
      )}

      {change ? (
        <section className={t.change} aria-live="polite">
          <p>{change.action === 'stopped' ? copy.companion.stopped(change.name) : copy.companion.started(change.name)}</p>
          <div className={home.actions}>
            {change.action === 'stopped' && change.stackItemId ? (
              <button type="button" className={home.primary} disabled={busy} onClick={() => takeOff(change.stackItemId!)}>
                {copy.companion.takeOff}
              </button>
            ) : change.action === 'started' ? (
              <button type="button" className={home.primary} disabled={busy} onClick={() => addIt(change.name)}>
                {copy.companion.addIt}
              </button>
            ) : null}
            <button type="button" className={home.secondary} onClick={clearLast}>
              {copy.companion.leave}
            </button>
          </div>
        </section>
      ) : null}

      {asks.map((a) => (
        <section key={a.stackItemId} className={t.change} aria-live="polite">
          <p>{copy.companion.askLoved(nameOf(a.stackItemId) || a.quote)}</p>
          <div className={home.actions}>
            {(['loved', 'neutral', 'borrowed'] as const).map((attachment) => (
              <button
                key={attachment}
                type="button"
                className={attachment === 'loved' ? home.primary : home.secondary}
                disabled={busy}
                onClick={() => {
                  clearLast();
                  void act(() => engineApi.run({ kind: 'confirm', stackItemId: a.stackItemId, attachment }));
                }}
              >
                {copy.companion[attachment]}
              </button>
            ))}
          </div>
        </section>
      ))}

      {error ? (
        <p className="notice" role="alert">
          {copy.days.error}
        </p>
      ) : null}

      <form
        className={t.composer}
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label={copy.companion.label}
          rows={3}
          maxLength={2000}
          value={text}
          placeholder={copy.companion.placeholder}
          onChange={(e) => setText(e.target.value)}
        />
        <div className={home.actions}>
          <button type="submit" className={home.primary} disabled={busy || !text.trim()}>
            {busy ? copy.companion.sending : copy.companion.send}
          </button>
          <Link className={t.threadLink} href="/today">
            {copy.companion.back} →
          </Link>
        </div>
      </form>
    </div>
  );
}
