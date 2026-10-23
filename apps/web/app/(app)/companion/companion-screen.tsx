'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { DStar } from '../../../components/d-star';
import { copy } from '../../../lib/copy';
import { useRouted } from '../../../lib/data/use-routed';
import { engineApi } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { useProgress } from '../../../lib/progress/context';
import { newItemId, type Progress } from '../../../lib/progress/types';
import { Arrow } from '../today/ritual-today';

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

  if (!ready || !on)
    return (
      <div className="d-tab-content d-distill-tab">
        <div className="d-chat-area">
          <div className="d-chat-thread">
            <Bubble from="distill" text={copy.companion.line} />
            {ready ? (
              <div className="d-prompt-card">
                <p className="d-prompt-card__body">{copy.app.companionSignIn}</p>
                <div className="d-prompt-card__actions">
                  <Link className="d-prompt-btn d-prompt-btn--confirm" href="/sign-in">
                    {copy.days.signIn}
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    );
  if (!state)
    return (
      <section className="d-tab-content d-distill-tab" aria-busy={!error}>
        <h1 className="d-sr">{copy.companion.title}</h1>
        {error ? (
          <p className="d-notice" role="alert">
            {copy.days.error}
          </p>
        ) : (
          <div className="d-wait">
            <span className="d-wait__line" />
            <span className="d-wait__line" />
          </div>
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
    <div className="d-tab-content d-distill-tab">
      <h1 className="d-sr">{copy.companion.title}</h1>
      <div className="d-chat-area">
        <ol className="d-chat-thread" aria-label={copy.companion.title}>
          {state.thread.length ? (
            state.thread.map((m) => (
              <Bubble
                key={m.id}
                from={m.role === 'person' ? 'me' : 'distill'}
                text={m.text}
                link={m.ritualVersionId ? <Link className="d-bubble-link" href="/today">{copy.companion.seeChange} →</Link> : null}
              />
            ))
          ) : (
            <Bubble from="distill" text={copy.companion.line} />
          )}

          {change ? (
            <li className="d-prompt-card" aria-live="polite">
              <p className="d-prompt-card__q">
                {change.action === 'stopped' ? copy.companion.stopped(change.name) : copy.companion.started(change.name)}
              </p>
              <div className="d-prompt-card__actions">
                {change.action === 'stopped' && change.stackItemId ? (
                  <button type="button" className="d-prompt-btn d-prompt-btn--confirm" disabled={busy} onClick={() => takeOff(change.stackItemId!)}>
                    {copy.companion.takeOff}
                  </button>
                ) : change.action === 'started' ? (
                  <button type="button" className="d-prompt-btn d-prompt-btn--confirm" disabled={busy} onClick={() => addIt(change.name)}>
                    {copy.companion.addIt}
                  </button>
                ) : null}
                <button type="button" className="d-prompt-btn" onClick={clearLast}>
                  {copy.companion.leave}
                </button>
              </div>
            </li>
          ) : null}

          {asks.map((a) => (
            <li key={a.stackItemId} className="d-prompt-card d-prompt-card--question" aria-live="polite">
              <p className="d-prompt-card__q">{copy.companion.askLoved(nameOf(a.stackItemId) || a.quote)}</p>
              <div className="d-prompt-card__actions d-prompt-card__actions--three">
                {(['loved', 'neutral', 'borrowed'] as const).map((attachment) => (
                  <button
                    key={attachment}
                    type="button"
                    className={`d-prompt-btn${attachment === 'loved' ? ' d-prompt-btn--confirm' : attachment === 'borrowed' ? ' d-prompt-btn--ghost' : ''}`}
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
            </li>
          ))}
          <li ref={end} aria-hidden="true" className="d-chat-end" />
        </ol>
      </div>

      {error ? (
        <p className="d-notice" role="alert">
          {copy.days.error}
        </p>
      ) : null}

      <form
        className="d-compose-bar d-compose-bar--distill"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input
          className="d-compose-input"
          aria-label={copy.companion.label}
          maxLength={2000}
          value={text}
          placeholder={busy ? copy.companion.sending : copy.app.message}
          onChange={(e) => setText(e.target.value)}
        />
        {text.trim() ? (
          <button type="submit" className="d-compose-send" aria-label={copy.app.send} disabled={busy}>
            <Arrow />
          </button>
        ) : null}
      </form>
    </div>
  );
}

/** One message: theirs in ink on the right, Distill's on paper on the left, with the star. */
function Bubble({ from, text, link }: { from: 'me' | 'distill'; text: string; link?: ReactNode }) {
  return (
    <li className={`d-bubble-wrap d-bubble-wrap--${from}`}>
      {from === 'distill' ? <DStar size="tiny" /> : null}
      <div className={`d-bubble d-bubble--${from}`}>
        <span className="d-sr">{from === 'me' ? copy.companion.you : copy.companion.distill}: </span>
        <p>{text}</p>
        {link}
      </div>
    </li>
  );
}
