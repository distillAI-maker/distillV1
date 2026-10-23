'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type ReactNode } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Mark } from '../../../components/onboarding/mark';
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

/** The brand's chisel star, small: a picked answer, a reflection. */
function Star({ className = 'study-star' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 40 40" aria-hidden="true">
      <path
        className="study-star__rays"
        d="M20 2.5l3.8 12.8 9.7-8.6-8.7 9.6 12.7 3.7-12.7 3.7 8.7 9.6-9.7-8.6L20 37.5l-3.8-12.8-9.7 8.6 8.7-9.6L2.5 20l12.7-3.7-8.7-9.6 9.7 8.6L20 2.5z"
      />
      <circle className="study-star__core" cx="20" cy="20" r="2.8" />
    </svg>
  );
}

/** A question: the parts of its line, the odd ones in italic with the hand-drawn underline. */
function Question({ parts, sub }: { parts: readonly string[]; sub?: string }) {
  return (
    <header className="study-intro">
      <h1>
        {parts.map((t, i) => (i % 2 ? <em key={i}>{t}</em> : <span key={i}>{t}</span>))}
      </h1>
      {sub ? <p className="study-sub">{sub}</p> : null}
    </header>
  );
}

function Choice({
  on,
  compact,
  onClick,
  children,
}: {
  on: boolean;
  compact?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      className={`study-choice${compact ? ' study-choice--compact' : ''}${on ? ' study-choice--on' : ''}`}
      onClick={onClick}
    >
      <span>{children}</span>
      {on ? <Star className="study-star study-star--small" /> : null}
    </button>
  );
}

function Reflection({ text, dark }: { text: string | null | undefined; dark?: boolean }) {
  return (
    <div className={`study-reflection${dark ? ' study-reflection--dark' : ''}`} aria-live="polite">
      {text ? (
        <>
          <Star className="study-star study-star--small" />
          <p key={text}>{text}</p>
        </>
      ) : null}
    </div>
  );
}

function Primary({ onClick, light, children }: { onClick: () => void; light?: boolean; children: ReactNode }) {
  return (
    <button type="button" className={`study-primary${light ? ' study-primary--light' : ''}`} onClick={onClick}>
      {children}
      <span aria-hidden="true">→</span>
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

  if (!ready || screen === null)
    return <main className="study" aria-busy="true" />;

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
      <div className="study-q">
        <Question parts={s.feed.q} sub={s.feed.sub} />
        <div className="study-grid">
          {items.map((i) => (
            <Choice key={i.id} on={feed.has(i.id)} onClick={() => update((p) => toggleFeed(p, i.id))}>
              {nameOf(i)}
            </Choice>
          ))}
        </div>
        <div className="study-bottom">
          <Reflection text={feed.size ? feedLine(progress) : null} />
          <Primary onClick={() => to(1)}>{s.feed.next}</Primary>
        </div>
      </div>
    );
  } else if (screen === 1) {
    const mineCount = picks.length + items.filter((i) => yours.has(i.id)).length;
    body = (
      <div className="study-q">
        <Question parts={s.yours.q} sub={s.yours.sub} />
        <div className="study-pills">
          {[...lifeChips, ...own].map((c) => (
            <Choice
              key={c}
              compact
              on={picked.has(c.toLowerCase())}
              onClick={() => update((p) => toggleLife(p, c, now()))}
            >
              {c}
            </Choice>
          ))}
          {items
            .filter((i) => !feed.has(i.id))
            .map((i) => (
              <Choice key={i.id} compact on={yours.has(i.id)} onClick={() => update((p) => toggleYours(p, i.id))}>
                {nameOf(i)}
              </Choice>
            ))}
          {adding ? (
            <form
              className="study-add-form"
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
            <button type="button" className="study-add" onClick={() => setAdding(true)}>
              <span aria-hidden="true">+</span> {s.yours.add}
            </button>
          )}
        </div>
        <div className="study-bottom">
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
      </div>
    );
  } else if (screen === 2) {
    const w = work(progress);
    body = (
      <div className="study-q">
        <Question parts={s.rhythm.q} />
        <p className="study-field">{s.rhythm.upAt}</p>
        <div className="study-time">
          <button type="button" aria-label={s.rhythm.earlier} onClick={() => update((p) => nudgeWake(p, -15, now()))}>
            −
          </button>
          <strong aria-live="polite">{wakeLabel(progress)}</strong>
          <button type="button" aria-label={s.rhythm.later} onClick={() => update((p) => nudgeWake(p, 15, now()))}>
            +
          </button>
        </div>
        <p className="study-field">{s.rhythm.daysAre}</p>
        <div className="study-pills">
          {s.rhythm.work.map((o) => (
            <Choice key={o} compact on={w === o} onClick={() => update((p) => setWork(p, o, now()))}>
              {o}
            </Choice>
          ))}
        </div>
        <div className="study-bottom">
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
      </div>
    );
  } else if (screen === 3 || screen === 4 || screen === 5) {
    const q = screen === 3 ? s.valve : screen === 4 ? s.busy : s.people;
    const current = screen === 3 ? valve(progress) : screen === 4 ? busyAnswer(progress) : people(progress);
    const set = screen === 3 ? setValve : screen === 4 ? setBusy : setPeople;
    body = (
      <div className="study-q">
        <Question parts={q.q} sub={'sub' in q ? q.sub : undefined} />
        <div className={screen === 3 ? 'study-grid' : `study-stack${screen === 5 ? ' study-stack--compact' : ''}`}>
          {q.options.map((o) => (
            <Choice
              key={o}
              on={current === o}
              onClick={() => {
                update((p) => set(p, o, now()));
                setAdvanceAt(Date.now());
              }}
            >
              {o}
            </Choice>
          ))}
        </div>
        <div className="study-bottom study-bottom--reflection">
          <Reflection text={current ? (q.reflections as Record<string, string>)[current] : null} />
        </div>
      </div>
    );
  } else {
    const read = readOf(progress);
    body = (
      <article className="study-read">
        <p className="study-eyebrow">{s.read.eyebrow}</p>
        <h1>
          {read.title[0]}
          <em>{read.title[1]}</em>
        </h1>
        {read.context ? <p className="study-read__context">{read.context}</p> : null}
        {read.promise ? (
          <>
            <div className="study-read__rule" />
            <div className="study-read__answer">
              <Star />
              <p>{read.promise}</p>
            </div>
          </>
        ) : null}
        <div className="study-bottom">
          <Reflection dark text={s.read.signoff} />
          <Primary light onClick={() => go('reveal')}>
            {s.read.next}
          </Primary>
        </div>
      </article>
    );
  }

  return (
    <main className={`study${dark ? ' study--dark' : ''}`}>
      <div className="study-col">
        <div className="study-top">
          <button type="button" className="study-back" aria-label={s.back} onClick={back}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>
          <div
            className="study-progress"
            role="progressbar"
            aria-label={copy.common.progressLabel}
            aria-valuemin={1}
            aria-valuemax={SCREENS}
            aria-valuenow={screen + 1}
          >
            {Array.from({ length: SCREENS }, (_, i) => (
              <span key={i} className={i < screen ? 'is-done' : i === screen ? 'is-current' : ''} />
            ))}
          </div>
          <span className="study-brand" translate="no">
            <Mark className="mark study-mark" />
            Distill
          </span>
        </div>
        <div className="study-folio">
          <span>{s.folio}</span>
          <span>{s.count(screen + 1, SCREENS)}</span>
        </div>
        <div key={screen} className="study-screen">
          {body}
        </div>
      </div>
    </main>
  );
}
