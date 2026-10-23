'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';
import type { RitualPart } from '@distill/engine/ritual';
import { DStar } from '../../../components/d-star';
import { RitualSheet } from '../../../components/ritual-sheet';
import { copy } from '../../../lib/copy';
import { engineApi, type EngineState } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { previewRitual } from '../../../lib/engine/preview';
import { alwaysYours } from '../../../lib/onboarding/reveal';
import { lifePicks, protectedThing, wakeSaid } from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';
import type { Progress } from '../../../lib/progress/types';
import { timeColumn, whyLine } from '../../../lib/ritual-lines';

type DayOut = EngineState['ritual']['today'];
type Part = DayOut['parts'][number];
export type View = 'morning' | 'night' | 'weekend';

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const isWeekend = (date: string) => weekday(date) === 0 || weekday(date) === 6;
const dayName = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** Morning until early afternoon, then night; the weekend view on Saturday and Sunday. */
export function defaultView(date: string, hour = new Date().getHours()): View {
  if (isWeekend(date)) return 'weekend';
  return hour < 14 ? 'morning' : 'night';
}

/** The days a view shows: today's (or the next weekday's) morning or night, or the coming weekend. */
export function daysFor(view: View, state: EngineState) {
  const today = state.ritual.today.date;
  const label = (date: string) => (date === today ? copy.days.today : dayName(date));
  const week = state.ritual.week;
  if (view === 'weekend')
    return week
      .filter((d) => isWeekend(d.date))
      .slice(0, 2)
      .map((d) => ({
        date: d.date,
        label: label(d.date),
        parts: d.parts.filter((p) => p.moment === (weekday(d.date) === 6 ? 'saturday' : 'sunday')),
      }));
  const day = week.find((d) => !isWeekend(d.date)) ?? state.ritual.today;
  return [{ date: day.date, label: label(day.date), parts: day.parts.filter((p) => p.moment === view) }];
}

/** A base week's parts by view, for the signed-out preview: mornings, nights, and what is weekend-only. */
function groupsOf(parts: readonly RitualPart[]): Record<View, RitualPart[]> {
  const active = parts.filter((p) => p.status === 'active');
  const weekendOnly = (p: RitualPart) => p.when.days.length > 0 && p.when.days.every((d) => d === 'sat' || d === 'sun');
  const morning = (p: RitualPart) => p.when.slot === 'morning' || p.when.slot === 'midday';
  return {
    morning: active.filter((p) => !weekendOnly(p) && morning(p)),
    night: active.filter((p) => !weekendOnly(p) && !morning(p)),
    weekend: active.filter(weekendOnly),
  };
}

/**
 * The time in this browser, once it has mounted. The server renders in UTC, so anything said from
 * the clock (the date, the greeting, which view opens) waits for the browser to avoid a mismatch.
 */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return now;
}

function TodayHeader({ name }: { name: string }) {
  const d = useNow();
  const h = d?.getHours() ?? 0;
  const date = d
    ? `${d.toLocaleDateString('en-GB', { weekday: 'long' })} · ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`
    : '\u00a0';
  return (
    <header className="d-today-header">
      <p className="d-today-date">{date}</p>
      <h1 className="d-today-greeting">
        {d ? copy.app.greeting(h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening', firstName(name)) : '\u00a0'}
      </h1>
    </header>
  );
}

function Views({ view, onPick }: { view: View; onPick: (v: View) => void }) {
  return (
    <div className="d-session-toggle" role="tablist" aria-label={copy.days.viewsLabel}>
      {(['morning', 'night', 'weekend'] as const).map((k) => (
        <button
          key={k}
          type="button"
          role="tab"
          aria-selected={view === k}
          className={`d-session-btn${view === k ? ' d-session-btn--active' : ''}`}
          onClick={() => onPick(k)}
        >
          {copy.days.views[k]}
        </button>
      ))}
    </div>
  );
}

/** One part of the day: when, what, a few words on why, and Done or Skip while it's today. */
function Row({ part, actions }: { part: RitualPart & { check?: Part['check'] }; actions?: ReactNode }) {
  const time = timeColumn(part.when, '');
  // No "Well-founded" here: a part's evidence tier says how much is known, not which way it points.
  const why = whyLine(part);
  const yours = part.lock === 'theirs';
  return (
    <li
      className={`d-ritual-row${yours ? ' d-ritual-row--yours' : ''}${part.check === 'done' ? ' d-ritual-row--done' : ''}${part.check === 'skipped' ? ' d-ritual-row--skipped' : ''}`}
    >
      <div className={`d-ritual-row__time${time.days ? ' d-ritual-row__time--days' : ''}`}>
        {time.lines.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      <div className="d-ritual-row__body">
        <p className="d-ritual-row__name">
          {part.title}
          {yours ? (
            <>
              <DStar size="tiny" />
              <span className="d-sr">{copy.days.yours}</span>
            </>
          ) : null}
        </p>
        {why ? <p className="d-ritual-row__why">{why}</p> : null}
      </div>
      <div className="d-ritual-row__actions">{actions}</div>
    </li>
  );
}

/** Tell Distill what's coming up. The reply shows above the bar; the whole thread lives at /companion. */
function Composer() {
  const { act, busy } = useEngine();
  const [text, setText] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  async function send() {
    const message = text.trim().slice(0, 2000);
    if (!message) return;
    const r = await act(() => engineApi.message(message));
    if (r) {
      setText('');
      setReply(r.reply ?? null);
    }
  }
  return (
    <>
      {reply ? (
        <div className="d-today-reply" aria-live="polite">
          <div className="d-bubble-wrap d-bubble-wrap--distill">
            <DStar size="tiny" />
            <div className="d-bubble d-bubble--distill">
              <p>{reply}</p>
              <Link className="d-bubble-link" href="/companion">
                {copy.app.thread} →
              </Link>
            </div>
          </div>
        </div>
      ) : null}
      <form
        className="d-compose-bar"
        aria-label={copy.days.tell}
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
          placeholder={copy.app.compose}
          onChange={(e) => setText(e.target.value)}
        />
        {text.trim() ? (
          <button type="submit" className="d-compose-send" aria-label={copy.app.send} disabled={busy}>
            <Arrow />
          </button>
        ) : null}
      </form>
    </>
  );
}

export function Arrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function Notice({ show }: { show: boolean }) {
  return show ? (
    <p className="d-notice" role="alert">
      {copy.days.error}
    </p>
  ) : null;
}

/** What's always theirs, for a draft's sheet: the things they'd never give up that aren't parts yet. */
const alwaysOf = (parts: readonly RitualPart[], progress: Progress) =>
  alwaysYours(parts, [...lifePicks(progress), protectedThing(progress)].filter((x): x is string => !!x));

/** Today: today's Ritual, a change to undo or keep, and a place to say what's coming up. */
export function RitualToday() {
  const { state, error, busy, act } = useEngine();
  const { progress } = useProgress();
  const [view, setView] = useState<View | null>(null);
  const name = state?.person.name || progress.name;

  if (!state)
    return (
      <section className="d-tab-content d-today-tab" aria-busy={!error}>
        <h1 className="d-sr">{copy.days.title}</h1>
        <Notice show={!!error} />
        {error ? null : (
          <div className="d-wait">
            <span className="d-wait__line" />
            <span className="d-wait__line" />
          </div>
        )}
      </section>
    );

  const r = state.ritual;
  if (r.status === 'none')
    return (
      <section className="d-tab-content d-today-tab" aria-busy="true">
        <div className="d-wait">
          {copy.days.shaping}
          <span className="d-wait__line" />
          <span className="d-wait__line" />
        </div>
      </section>
    );

  if (r.status === 'proposed' && r.proposed)
    return (
      <div className="d-tab-content d-ritual-scroll">
        <RitualSheet
          name={firstName(name)}
          wake={wakeSaid(progress)}
          parts={r.proposed.parts}
          always={alwaysOf(r.proposed.parts, progress)}
        >
          <Notice show={!!error} />
          <button
            type="button"
            className="d-primary"
            disabled={busy}
            onClick={() => void act(() => engineApi.accept(r.proposed!.id))}
          >
            {copy.days.accept}
            <span aria-hidden="true">→</span>
          </button>
          <Link className="d-ritual-change" href="/companion">
            {copy.app.ritual.change}
          </Link>
        </RitualSheet>
      </div>
    );

  const today = r.today.date;
  const v = view ?? defaultView(today);
  const days = daysFor(v, state);
  const change = r.lastChange?.undoable && r.lastChange.reply ? r.lastChange : null;
  const ongoing = r.proposed?.parentId ? r.proposed : null;
  const check = (part: Part, date: string, done: boolean) =>
    void act(() => engineApi.run({ kind: 'part', partId: part.id, date, done }));

  return (
    <div className="d-tab-content d-today-tab">
      <TodayHeader name={name} />
      <Views view={v} onPick={setView} />
      <Notice show={!!error} />

      {change ? (
        <section className="d-adjustment-banner" aria-live="polite">
          <div className="d-adjustment-banner__text">
            <p className="d-adjustment-banner__title">
              {change.scope === 'day' ? copy.days.adjusted(dayName(change.date)) : copy.days.weekAdjusted}
            </p>
            <p className="d-adjustment-banner__body">{change.reply}</p>
          </div>
          <button
            type="button"
            className="d-adjustment-banner__undo"
            disabled={busy}
            onClick={() => void act(() => engineApi.undo(change.versionId))}
          >
            {copy.days.undo}
          </button>
        </section>
      ) : null}

      {ongoing ? (
        <section className="d-adjustment-banner d-adjustment-banner--ask">
          <div className="d-adjustment-banner__text">
            <p className="d-adjustment-banner__title">{copy.days.proposalTitle}</p>
            {ongoing.reply ? <p className="d-adjustment-banner__body">{ongoing.reply}</p> : null}
          </div>
          <div className="d-adjustment-banner__actions">
            <button
              type="button"
              className="d-ritual-row__done"
              disabled={busy}
              onClick={() => void act(() => engineApi.accept(ongoing.id))}
            >
              {copy.days.keepChange}
            </button>
            <button
              type="button"
              className="d-ritual-row__skip"
              disabled={busy}
              onClick={() => void act(() => engineApi.undo(ongoing.id))}
            >
              {copy.days.notNow}
            </button>
          </div>
        </section>
      ) : null}

      {days.map((d) => (
        <section key={d.date} className="d-today-day" aria-label={d.label}>
          {v === 'weekend' || d.date !== today ? <h2 className="d-day-label">{d.label}</h2> : null}
          {d.parts.length ? (
            <ul className="d-ritual-rows">
              {d.parts.map((p) => (
                <Row
                  key={p.id}
                  part={p}
                  actions={
                    d.date !== today ? null : p.check === 'done' ? (
                      <span className="d-ritual-row__check">{copy.days.didIt}</span>
                    ) : p.check === 'skipped' ? (
                      <span className="d-ritual-row__skip-label">{copy.days.skipped}</span>
                    ) : (
                      <>
                        <button
                          type="button"
                          className="d-ritual-row__done"
                          disabled={busy}
                          aria-label={copy.days.done}
                          onClick={() => check(p, d.date, true)}
                        >
                          {copy.days.done}
                        </button>
                        <button
                          type="button"
                          className="d-ritual-row__skip"
                          disabled={busy}
                          aria-label={copy.days.skip}
                          onClick={() => check(p, d.date, false)}
                        >
                          {copy.days.skip}
                        </button>
                      </>
                    )
                  }
                />
              ))}
            </ul>
          ) : (
            <p className="d-today-empty">{copy.days.empty}</p>
          )}
        </section>
      ))}

      {progress.dayOne.started ? (
        <Link className="d-today-link" href="/today/reading">
          {copy.days.readings} →
        </Link>
      ) : null}

      <Composer />
    </div>
  );
}

/** Signed out: the same rules on what they typed, nothing stored, and a way to keep it. */
export function RitualPreview() {
  const { ready, progress } = useProgress();
  const [parts, setParts] = useState<readonly RitualPart[] | null>(null);
  const now = useNow();
  const [picked, setView] = useState<View | null>(null);
  const view: View = picked ?? (now ? defaultView(now.toLocaleDateString('en-CA'), now.getHours()) : 'morning');
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    previewRitual(progress, zone)
      .then((p) => alive && setParts(p.parts))
      .catch(() => alive && setParts([]));
    return () => {
      alive = false;
    };
  }, [ready, progress]);
  const shown = parts ? groupsOf(parts)[view] : [];
  return (
    <div className="d-tab-content d-today-tab">
      <TodayHeader name={progress.name} />
      <Views view={view} onPick={setView} />
      {!parts ? (
        <div className="d-wait">
          <span className="d-wait__line" />
          <span className="d-wait__line" />
        </div>
      ) : shown.length ? (
        <ul className="d-ritual-rows">
          {shown.map((p) => (
            <Row key={p.id} part={p} />
          ))}
        </ul>
      ) : (
        <p className="d-today-empty">{copy.days.empty}</p>
      )}
      <div className="d-today-keep">
        <div className="d-prompt-card">
          <p className="d-prompt-card__body">{copy.days.signedOut}</p>
          <div className="d-prompt-card__actions">
            <Link className="d-prompt-btn d-prompt-btn--confirm" href="/sign-in">
              {copy.days.signIn}
            </Link>
          </div>
        </div>
      </div>
      {progress.dayOne.started ? (
        <Link className="d-today-link" href="/today/reading">
          {copy.days.readings} →
        </Link>
      ) : null}
    </div>
  );
}
