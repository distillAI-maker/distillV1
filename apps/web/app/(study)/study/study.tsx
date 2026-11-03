'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Arrow, Brand, Bubble, Mark } from '../../../components/ds/ui';
import { displayName } from '../../../lib/catalog/short-names';
import { copy } from '../../../lib/copy';
import {
  addOwnThing,
  busyAnswer,
  confirmWake,
  feedLine,
  firstOpen,
  fromFeed,
  lifeChips,
  lifePicks,
  nudgeWake,
  people,
  readOf,
  setBusy,
  setPeople,
  setValve,
  setWork,
  studyItems,
  toggleFeed,
  toggleLife,
  toggleYours,
  valve,
  wakeLabel,
  work,
} from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';

const s = copy.study;
const SCREENS = 7;
/** How long a single-choice answer's reflection shows before the next question. */
const ADVANCE_MS = 1100;

/** A question: its words in one plain line (the italics belong to the number and the read only). */
function Question({ parts, sub }: { parts: readonly string[]; sub?: string }) {
  return (
    <header className="st-heading">
      <h1>{parts.join('')}</h1>
      {sub ? <p>{sub}</p> : null}
    </header>
  );
}

function Reflection({ text, dark }: { text: string | null | undefined; dark?: boolean }) {
  return (
    <div className="st-reflection" aria-live="polite">
      {text ? (
        <>
          <Mark size="sm" light={dark} />
          <p key={text}>{text}</p>
        </>
      ) : null}
    </div>
  );
}

function Primary({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" className="ds-primary" onClick={onClick}>
      {children}
      <Arrow />
    </button>
  );
}

/**
 * Step 4, the private study: six taps, each answered with one line, then the read on the night
 * palette. Multi-choice questions end with a button in their voice; single-choice ones move on by
 * themselves a moment after the reflection shows. Answers save as they're tapped.
 */
export function Study({ names }: { names: Record<string, string> }) {
  const router = useRouter();
  const go = useGo();
  const { ready, progress, update } = useProgress();
  const [screen, setScreen] = useState<number | null>(null);
  const [advanceAt, setAdvanceAt] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const addId = useId();

  // Open where they left off: the first open question, or the read when everything is answered.
  useEffect(() => {
    if (ready && screen === null) setScreen(firstOpen(progress));
  }, [ready, screen, progress]);

  // A single-choice answer shows its reflection, then moves on. Another tap restarts the wait.
  useEffect(() => {
    if (advanceAt === null) return;
    const t = window.setTimeout(() => {
      setAdvanceAt(null);
      setScreen((i) => (i === null ? i : Math.min(SCREENS - 1, i + 1)));
    }, ADVANCE_MS);
    return () => window.clearTimeout(t);
  }, [advanceAt]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [screen]);

  const now = () => new Date().toISOString();
  const to = (i: number) => {
    setAdvanceAt(null);
    setScreen(i);
  };
  const back = () => {
    if (screen === null || screen === 0) router.push('/number');
    else to(screen - 1);
  };

  if (!ready || screen === null) return <main className="ob-main" aria-busy="true" />;

  const items = studyItems(progress);
  const nameOf = (i: (typeof items)[number]) => displayName(i, i.itemKey ? names[i.itemKey] : undefined);
  const feed = new Set(fromFeed(progress));
  const yours = new Set(progress.dayOne.yours);
  const picks = lifePicks(progress);
  const picked = new Set(picks.map((p) => p.toLowerCase()));
  const own = picks.filter((p) => !lifeChips.some((c) => c.toLowerCase() === p.toLowerCase()));
  const dark = screen === SCREENS - 1;

  function addDraft() {
    const text = draft.trim();
    if (text) update((p) => addOwnThing(p, text, now()));
    setDraft('');
    setAdding(false);
  }

  let body: ReactNode;
  if (screen === 0) {
    body = (
      <>
        <Question parts={s.feed.q} sub={s.feed.sub} />
        <div className="st-tiles">
          {items.map((i) => (
            <button
              key={i.id}
              type="button"
              className="st-tile"
              aria-pressed={feed.has(i.id)}
              onClick={() => update((p) => toggleFeed(p, i.id))}
            >
              <span>{nameOf(i)}</span>
              {feed.has(i.id) ? <Mark size="xs" light /> : null}
            </button>
          ))}
        </div>
        <div className="st-bottom">
          <Reflection text={feed.size ? feedLine(progress) : null} />
          <Primary onClick={() => to(1)}>{s.feed.next}</Primary>
        </div>
      </>
    );
  } else if (screen === 1) {
    const mineCount = picks.length + items.filter((i) => yours.has(i.id)).length;
    body = (
      <>
        <Question parts={s.yours.q} sub={s.yours.sub} />
        <div className="ds-bubbles">
          {[...lifeChips, ...own].map((c) => (
            <Bubble key={c} on={picked.has(c.toLowerCase())} onClick={() => update((p) => toggleLife(p, c, now()))}>
              {c}
            </Bubble>
          ))}
          {items
            .filter((i) => !feed.has(i.id))
            .map((i) => (
              <Bubble key={i.id} on={yours.has(i.id)} onClick={() => update((p) => toggleYours(p, i.id))}>
                {nameOf(i)}
              </Bubble>
            ))}
          {adding ? (
            <form
              className="st-add"
              onSubmit={(e) => {
                e.preventDefault();
                addDraft();
              }}
            >
              <label className="sr-only" htmlFor={addId}>
                {s.yours.addLabel}
              </label>
              <input
                id={addId}
                autoFocus
                value={draft}
                maxLength={80}
                enterKeyHint="done"
                placeholder={s.yours.addPlaceholder}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={addDraft}
              />
            </form>
          ) : (
            <button type="button" className="ds-bubble ds-bubble--add" onClick={() => setAdding(true)}>
              <span aria-hidden="true">+</span> {s.yours.add}
            </button>
          )}
        </div>
        <div className="st-bottom">
          <Reflection text={mineCount ? s.yours.reflection : null} />
          <Primary
            onClick={() => {
              if (draft.trim()) addDraft();
              to(2);
            }}
          >
            {s.yours.next}
          </Primary>
        </div>
      </>
    );
  } else if (screen === 2) {
    const w = work(progress);
    body = (
      <>
        <Question parts={s.rhythm.q} />
        <section className="ds-card st-box">
          <span className="st-field-label">{s.rhythm.upAt}</span>
          <div className="st-time">
            <button type="button" aria-label={s.rhythm.earlier} onClick={() => update((p) => nudgeWake(p, -15, now()))}>
              −
            </button>
            <strong aria-live="polite">{wakeLabel(progress)}</strong>
            <button type="button" aria-label={s.rhythm.later} onClick={() => update((p) => nudgeWake(p, 15, now()))}>
              +
            </button>
          </div>
        </section>
        <section className="ds-card st-box">
          <span className="st-field-label">{s.rhythm.daysAre}</span>
          <div className="ds-bubbles">
            {s.rhythm.work.map((o) => (
              <Bubble key={o} on={w === o} onClick={() => update((p) => setWork(p, o, now()))}>
                {o}
              </Bubble>
            ))}
          </div>
        </section>
        <div className="st-bottom">
          <Reflection text={w ? (s.rhythm.reflections as Record<string, string>)[w] : null} />
          <Primary
            onClick={() => {
              update((p) => confirmWake(p, now()));
              to(3);
            }}
          >
            {s.rhythm.next}
          </Primary>
        </div>
      </>
    );
  } else if (screen === 3 || screen === 4 || screen === 5) {
    const q = screen === 3 ? s.valve : screen === 4 ? s.busy : s.people;
    const current = screen === 3 ? valve(progress) : screen === 4 ? busyAnswer(progress) : people(progress);
    const set = screen === 3 ? setValve : screen === 4 ? setBusy : setPeople;
    body = (
      <>
        <Question parts={q.q} sub={'sub' in q ? q.sub : undefined} />
        <div className="st-list">
          {q.options.map((o) => (
            <button
              key={o}
              type="button"
              className="st-option"
              aria-pressed={current === o}
              onClick={() => {
                update((p) => set(p, o, now()));
                setAdvanceAt(Date.now());
              }}
            >
              <span>{o}</span>
              {current === o ? <Mark size="xs" light /> : <Arrow />}
            </button>
          ))}
        </div>
        <div className="st-bottom">
          <Reflection text={current ? (q.reflections as Record<string, string>)[current] : null} />
        </div>
      </>
    );
  } else {
    const read = readOf(progress);
    body = (
      <article className="st-heard">
        <span className="st-heard-label">{s.read.eyebrow}</span>
        <h1>
          {read.title[0]}
          <em>{read.title[1]}</em>
        </h1>
        {read.context ? <p className="st-heard-context">{read.context}</p> : null}
        {read.promise ? (
          <>
            <div className="st-heard-rule" />
            <div className="st-heard-promise">
              <Mark size="sm" light />
              <p>{read.promise}</p>
            </div>
          </>
        ) : null}
      </article>
    );
  }

  return (
    <main className={`ob-main${dark ? ' st-dark' : ''}`}>
      {dark ? <div className="st-ring" aria-hidden="true" /> : null}
      <div className="st-top">
        <button type="button" className="ob-back" onClick={back}>
          {s.back}
        </button>
        <div
          className="st-dashes"
          role="progressbar"
          aria-label={copy.common.progressLabel}
          aria-valuemin={1}
          aria-valuemax={SCREENS}
          aria-valuenow={screen + 1}
        >
          {Array.from({ length: SCREENS }, (_, i) => (
            <i key={i} className={i < screen ? 'is-past' : i === screen ? 'is-now' : ''} />
          ))}
        </div>
        <Brand light={dark} size="sm" />
      </div>
      <div className="st-meta">
        <span>{s.folio}</span>
        <span>{s.count(screen + 1, SCREENS)}</span>
      </div>
      <div key={screen} className="st-content">
        {body}
        {dark ? (
          <div className="st-heard-foot">
            <div className="st-heard-signoff">
              <Mark size="xs" light />
              <span>{s.read.signoff}</span>
            </div>
            <Primary onClick={() => go('reveal')}>{s.read.next}</Primary>
          </div>
        ) : null}
      </div>
    </main>
  );
}
