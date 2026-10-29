'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { RitualPart } from '@distill/engine/ritual';
import { Icon } from '../../../components/ds/icons';
import { Sheet } from '../../../components/ds/sheet';
import { Arrow, Bubble, Locked, Mark } from '../../../components/ds/ui';
import { useNames } from '../../../components/ds/use-names';
import { useRefreshOnReturn } from '../../../components/ds/use-refresh-on-return';
import { copy } from '../../../lib/copy';
import { engineApi, type EngineResult, type EngineState } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { previewRitual } from '../../../lib/engine/preview';
import { useProgress } from '../../../lib/progress/context';
import { saidMakeItMine } from '../../../lib/steps';
import { newItemId, type Progress } from '../../../lib/progress/types';
import { revealGroups, whenLine } from '../../../lib/ritual-groups';
import { whyLine } from '../../../lib/ritual-lines';
import {
  changesBetween,
  dayOfMonth,
  longDate,
  partsOn,
  timeLabel,
  weekdayLetter,
  weekdayName,
  type Mark as ChangeMark,
} from '../../../lib/ritual-view';
import { DailyCard, type WhyKind } from './daily-card';

const t = copy.ritualTab;
type Day = EngineState['ritual']['today'];
type DayPart = Day['parts'][number];
type ShownPart = RitualPart & { readonly check?: DayPart['check'] };

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';

/** The browser's clock, once mounted: the server renders in UTC, so the greeting waits for it. */
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);
  return now;
}

function Header({ date, name, thinking }: { date: string | null; name: string; thinking?: boolean }) {
  const now = useNow();
  const h = now?.getHours() ?? 0;
  return (
    <header className="tb-header">
      <div>
        <span>{date ? longDate(date) : ' '}</span>
        <h1>{now ? copy.app.greeting(h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening', firstName(name)) : ' '}</h1>
      </div>
      <Mark turning={thinking} />
    </header>
  );
}

/** Seven days from today: a dot a part, people dots in persimmon, a changed day outlined. */
function Week({
  days,
  today,
  selected,
  onPick,
}: {
  days: readonly { date: string; parts: readonly { id: string; people?: readonly string[] }[]; changed?: boolean }[];
  today: string;
  selected: string;
  onPick: (date: string) => void;
}) {
  const first = days[0]?.date;
  const last = days[days.length - 1]?.date;
  const span =
    first && last
      ? `${new Date(`${first}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} – ${new Date(`${last}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
      : '';
  return (
    <section className="ds-card rt-week" aria-label={t.week}>
      <div className="tb-section-head">
        <h2>{t.week}</h2>
        <span>{span}</span>
      </div>
      <div className="rt-days">
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            className={`rt-day${d.date === today ? ' is-today' : ''}${d.changed ? ' is-changed' : ''}`}
            aria-pressed={d.date === selected}
            aria-label={`${weekdayName(d.date)}${d.changed ? `, ${t.adjusted(weekdayName(d.date)).toLowerCase()}` : ''}`}
            onClick={() => onPick(d.date)}
          >
            <span>{weekdayLetter(d.date)}</span>
            <span className="rt-dots" aria-hidden="true">
              {d.parts.slice(0, 4).map((p) => (
                <i key={p.id} className={p.people?.length ? 'is-people' : ''} />
              ))}
            </span>
            <small>{dayOfMonth(d.date)}</small>
          </button>
        ))}
      </div>
      <div className="rt-key" aria-hidden="true">
        <span>
          <i /> {t.everyday}
        </span>
        <span>
          <i className="is-people" /> {t.withPeople}
        </span>
      </div>
    </section>
  );
}

/** One day as a single line from morning to night. Today's parts can be ticked off. */
function Timeline({
  parts,
  marks,
  onCheck,
  ticked,
}: {
  parts: readonly ShownPart[];
  marks?: Map<string, ChangeMark>;
  onCheck?: (part: ShownPart) => void;
  /** Ticked on this phone, shown at once while the engine records it. */
  ticked?: ReadonlySet<string>;
}) {
  if (!parts.length) return <p className="rt-empty">{t.nothing}</p>;
  return (
    <ol className="rt-timeline">
      {parts.map((p, i) => {
        const mark = marks?.get(p.id);
        const done = p.check === 'done' || !!ticked?.has(p.id);
        const why = whyLine(p);
        return (
          <li
            key={p.id}
            className={`rt-item${mark ? ' is-changed' : ''}${done ? ' is-done' : ''}`}
            style={{ animationDelay: `${Math.min(i, 6) * 0.05}s` }}
          >
            <div className="rt-time">
              {timeLabel(p)}
              {mark?.was ? <small>{t.was(mark.was)}</small> : null}
            </div>
            <div className="rt-card">
              {mark ? <span className="rt-label">{t.labels[mark.label]}</span> : null}
              <strong>{p.title}</strong>
              {why ? <p>{why}</p> : null}
              {p.lock === 'theirs' ? <Locked>{t.yours}</Locked> : p.lock === 'clinician' ? <Locked>{t.clinician}</Locked> : null}
            </div>
            {onCheck ? (
              <button
                type="button"
                className="rt-check"
                aria-label={done ? t.done(p.title) : t.check(p.title)}
                aria-pressed={done}
                disabled={done}
                onClick={() => onCheck(p)}
              >
                {done ? <Icon name="check" /> : null}
              </button>
            ) : (
              <span />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Parts that happen a few times a week on no fixed day: not on the timeline, so listed under it. */
function AnyDay({ parts }: { parts: readonly RitualPart[] }) {
  const flexible = parts.filter((p) => p.status === 'active' && !p.when.days.length && p.when.perWeek);
  if (!flexible.length) return null;
  return (
    <section className="rt-anyday" aria-label={t.anyDay}>
      <h3>{t.anyDay}</h3>
      <ul>
        {flexible.map((p) => (
          <li key={p.id}>
            <strong>{p.title}</strong>
            <span>{whenLine(p.when)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** "What's coming up?": a sheet with a few starts, a box, and Tell Distill. */
function ComingUp({ onSend, onClose }: { onSend: (text: string) => void; onClose: () => void }) {
  const [text, setText] = useState('');
  return (
    <Sheet eyebrow={t.tell} title={t.comingUp} closeLabel={t.close} onClose={onClose} className="rt-sheet">
      <p className="rt-sheet-line">{t.tellLine}</p>
      <div className="ds-bubbles">
        {t.suggestions.map((s) => (
          <Bubble key={s} on={text === s} onClick={() => setText(s)}>
            {s}
          </Bubble>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const m = text.trim().slice(0, 2000);
          if (m) onSend(m);
        }}
      >
        <label className="sr-only" htmlFor="coming-up">
          {t.comingUp}
        </label>
        <textarea id="coming-up" autoFocus value={text} maxLength={2000} placeholder={t.placeholder} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="ds-primary" disabled={!text.trim()}>
          {t.send}
          <Arrow />
        </button>
      </form>
    </Sheet>
  );
}

/** Why? on a card or a thing: Distill's answer about it, in a sheet. */
export function WhySheet({ ask, about, onClose }: { ask: string; about: string; onClose: () => void }) {
  const { act } = useEngine();
  const [result, setResult] = useState<EngineResult | null | undefined>(undefined);
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void act(() => engineApi.message(ask, about)).then(setResult);
  }, [act, ask, about]);
  return (
    <Sheet eyebrow={ask} title={t.whyTitle} closeLabel={t.close} onClose={onClose}>
      <div className="rt-why" aria-live="polite">
        <Mark size="sm" turning={result === undefined} />
        <p>{result === undefined ? t.whyWaiting : result === null ? t.error : (result.reply ?? '')}</p>
      </div>
      {result?.swap ? (
        <p style={{ marginTop: 8, color: 'var(--muted)' }}>
          {copy.swap.ask} <strong style={{ color: 'var(--ink)' }}>{result.swap.title}</strong>
        </p>
      ) : null}
    </Sheet>
  );
}

/** What came back with a reply that needs their yes: a change to their list, or a feeling about a thing. */
function Followups({ result, nameOf }: { result: EngineResult; nameOf: (id?: string | null) => string }) {
  const { progress, update } = useProgress();
  const { act, busy } = useEngine();
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const change = result.stackChange;
  const asks = result.ask ?? [];
  if ((!change || answered.change) && asks.every((a) => answered[a.stackItemId])) return null;

  function takeOff(stackItemId: string) {
    const next: Progress = { ...progress, items: progress.items.map((i) => (i.id === stackItemId ? { ...i, status: 'cut' } : i)) };
    update(next);
    setAnswered((a) => ({ ...a, change: true }));
    void act(() => engineApi.run({ kind: 'stack-change' }), { save: next });
  }
  function addIt(name: string) {
    const next: Progress = {
      ...progress,
      items: [
        ...progress.items,
        { id: newItemId(), itemKey: null, customName: name.slice(0, 120), monthlyCost: 0, answers: {}, chips: {}, unknown: [], status: 'listed', notes: [], position: progress.items.length },
      ],
    };
    update(next);
    setAnswered((a) => ({ ...a, change: true }));
    void act(() => engineApi.run({ kind: 'stack-change' }), { save: next });
  }

  return (
    <>
      {change && !answered.change ? (
        <div className="rt-reply-actions">
          <p style={{ flexBasis: '100%', fontSize: 15 }}>
            {change.action === 'stopped' ? copy.companion.stopped(change.name) : copy.companion.started(change.name)}
          </p>
          {change.action === 'stopped' && change.stackItemId ? (
            <button type="button" className="ds-bubble" disabled={busy} onClick={() => takeOff(change.stackItemId!)}>
              {copy.companion.takeOff}
            </button>
          ) : change.action === 'started' ? (
            <button type="button" className="ds-bubble" disabled={busy} onClick={() => addIt(change.name)}>
              {copy.companion.addIt}
            </button>
          ) : null}
          <button type="button" className="ds-bubble" onClick={() => setAnswered((a) => ({ ...a, change: true }))}>
            {copy.companion.leave}
          </button>
        </div>
      ) : null}
      {asks
        .filter((a) => !answered[a.stackItemId])
        .map((a) => (
          <div key={a.stackItemId} className="rt-reply-actions">
            <p style={{ flexBasis: '100%', fontSize: 15 }}>{copy.companion.askLoved(nameOf(a.stackItemId) || a.quote)}</p>
            {(['loved', 'neutral', 'borrowed'] as const).map((attachment) => (
              <button
                key={attachment}
                type="button"
                className="ds-bubble"
                disabled={busy}
                onClick={() => {
                  setAnswered((x) => ({ ...x, [a.stackItemId]: true }));
                  void act(() => engineApi.run({ kind: 'confirm', stackItemId: a.stackItemId, attachment }));
                }}
              >
                {copy.companion[attachment]}
              </button>
            ))}
          </div>
        ))}
    </>
  );
}

/** A lasting change waits for their yes: the proposed week, Make this my week, Not now. */
function ProposedWeek({ version, onAccept, onDecline, busy }: { version: NonNullable<EngineState['ritual']['proposed']>; onAccept: () => void; onDecline: () => void; busy: boolean }) {
  const byId = new Map(version.parts.map((p) => [p.id, p]));
  const rows = version.changes
    .map((c) => ({ c, part: byId.get(c.partId) }))
    .filter((r) => r.part)
    .slice(0, 4);
  return (
    <section className="rt-preview" aria-label={t.proposedWeek}>
      <span className="ds-eyebrow">{t.proposedWeek}</span>
      {version.reply ? <p>{version.reply}</p> : null}
      {rows.map(({ c, part }) => (
        <div key={`${c.op}-${c.partId}`} className="rt-preview-row">
          <b>{whenLine(part!.when)}</b>
          <strong>{part!.title}</strong>
          {c.reason ? <small>{c.reason}</small> : null}
        </div>
      ))}
      <button type="button" className="ds-primary" disabled={busy} onClick={onAccept}>
        {t.makeThisMyWeek}
        <Arrow />
      </button>
      <div style={{ display: 'grid', justifyItems: 'center' }}>
        <button type="button" className="ds-link" disabled={busy} onClick={onDecline}>
          {t.notNow}
        </button>
      </div>
    </section>
  );
}

/** Signed in: today's Ritual from the engine, and everything that changes it. */
export function RitualTab() {
  const { state, error, busy, act, retry } = useEngine();
  const { progress } = useProgress();
  const { nameOf, routed } = useNames();
  const [selected, setSelected] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [sent, setSent] = useState<{ text: string; result: EngineResult } | null>(null);
  const [marks, setMarks] = useState<{ date: string; map: Map<string, ChangeMark> } | null>(null);
  const [why, setWhy] = useState<{ ask: string; about: string } | null>(null);
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set());
  const top = useRef<HTMLDivElement>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const name = state?.person.name || progress.name;
  if (!state)
    return (
      <main className="tb-page" aria-busy={!error}>
        <Header date={null} name={name} />
        {error ? (
          <>
            <p className="ds-notice" role="alert">
              {t.error}
            </p>
            <button type="button" className="ds-secondary" onClick={retry}>
              {t.tryAgain}
            </button>
          </>
        ) : (
          <div className="tb-wait">
            <i />
            <i />
          </div>
        )}
      </main>
    );

  const r = state.ritual;
  const today = r.today.date;

  // "Make it mine" already said yes: while the engine's first version is accepted, it's still shaping.
  const accepting = r.status === 'proposed' && !!r.proposed && !r.proposed.parentId && saidMakeItMine(progress.step);
  if (r.status === 'none' || accepting)
    return (
      <main className="tb-page" aria-busy="true">
        <Header date={today} name={name} />
        <div className="tb-wait">
          <p>{copy.days.shaping}</p>
          <i />
          <i />
        </div>
      </main>
    );

  // Someone whose first Ritual is still a draft (from before "Make it mine"): it waits for their yes.
  if (r.status === 'proposed' && r.proposed && !r.proposed.parentId)
    return (
      <main className="tb-page">
        <Header date={today} name={name} />
        <section className="ds-card">
          <h2 style={{ fontSize: 28 }}>{t.firstDraft}</h2>
          <p style={{ marginTop: 8, color: 'var(--muted)' }}>{t.firstDraftLine}</p>
        </section>
        <div className="rv-groups" style={{ marginTop: 22 }}>
          {revealGroups(r.proposed.parts).map((g) => (
            <section key={g.key} className="rv-group">
              <h2>{g.label}</h2>
              <ul>
                {g.rows.map((row) => (
                  <li key={row.id} className="rv-part">
                    <span className="rv-part-time">{row.when}</span>
                    <strong>{row.title}</strong>
                    {row.why ? <p>{row.why}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
        <div className="rv-actions">
          <button type="button" className="ds-primary" disabled={busy} onClick={() => void act(() => engineApi.accept(r.proposed!.id))}>
            {copy.days.accept}
            <Arrow />
          </button>
        </div>
      </main>
    );

  const week = r.week;
  const shown = selected && week.some((d) => d.date === selected) ? selected : today;
  const day = week.find((d) => d.date === shown) ?? r.today;
  const change = r.lastChange?.undoable ? r.lastChange : null;
  const ongoing = r.proposed?.parentId ? r.proposed : null;
  const firstDay = week.every((d) => d.parts.every((p) => !p.check)) && !change;
  const lastPerson = [...state.thread].reverse().find((m) => m.role === 'person');
  const reply = sent?.result.reply ?? change?.reply;
  const youSaid = sent?.text ?? (change?.reply ? lastPerson?.text : undefined);
  const dayMarks = marks?.date === day.date ? marks.map : undefined;

  /** A tick shows at once; the engine records it behind. If it doesn't go through, the tick comes off. */
  async function tick(partId: string) {
    setTicked((t0) => new Set([...t0, partId]));
    const res = await act(() => engineApi.run({ kind: 'part', partId, date: today, done: true }));
    if (!res)
      setTicked((t0) => {
        const next = new Set(t0);
        next.delete(partId);
        return next;
      });
  }

  async function send(text: string) {
    setComposing(false);
    setThinking(true);
    const before = state!.ritual.week;
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const res = await act(() => engineApi.message(text));
    setThinking(false);
    if (!res) return;
    setSent({ text, result: res });
    const lc = res.state.ritual.lastChange;
    if (res.versionId && lc?.versionId === res.versionId && lc.scope === 'day') {
      // Mark what changed on that day, in place, by comparing it with how it was a moment ago.
      const was = before.find((d) => d.date === lc.date)?.parts ?? [];
      const now = res.state.ritual.week.find((d) => d.date === lc.date)?.parts ?? [];
      setMarks({ date: lc.date, map: changesBetween(was, now) });
      setSelected(lc.date);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="tb-page" ref={top}>
      <Header date={day.date} name={name} thinking={thinking || (busy && !!sent)} />
      {error ? (
        <p className="ds-notice" role="alert">
          {t.error}
        </p>
      ) : null}

      {reply ? (
        <>
          {youSaid ? <p className="rt-you">{t.you(youSaid)}</p> : null}
          <section className="rt-reply" aria-live="polite">
            <Mark size="sm" />
            <div>
              <span className="ds-eyebrow">{copy.companion.distill}</span>
              <p>{reply}</p>
              {sent ? <Followups result={sent.result} nameOf={nameOf} /> : null}
            </div>
          </section>
        </>
      ) : null}

      {change ? (
        <div className="rt-banner">
          <span>
            <Mark size="xs" />
            {change.scope === 'day' ? t.adjusted(weekdayName(change.date)) : t.weekAdjusted}
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              if (await act(() => engineApi.undo(change.versionId))) {
                setMarks(null);
                setSent(null);
                setSelected(null);
              }
            }}
          >
            {t.undo}
          </button>
        </div>
      ) : null}

      {ongoing ? (
        <ProposedWeek
          version={ongoing}
          busy={busy}
          onAccept={() => void act(() => engineApi.accept(ongoing.id))}
          onDecline={() => void act(() => engineApi.undo(ongoing.id))}
        />
      ) : null}

      <Week days={week} today={today} selected={day.date} onPick={setSelected} />
      {firstDay && day.date === today ? <p className="rt-welcome">{t.firstDay}</p> : null}
      <h2 className="rt-day-head">{day.date === today ? t.today : longDate(day.date)}</h2>
      <Timeline
        key={day.date}
        parts={day.parts}
        marks={dayMarks}
        ticked={ticked}
        onCheck={day.date === today ? (p) => void tick(p.id) : undefined}
      />

      <DailyCard
        state={state}
        routed={routed}
        nameOf={nameOf}
        onWhy={(id: string, kind: WhyKind) => setWhy({ ask: copy.companion.why[kind](nameOf(id) || copy.decide.why), about: id })}
      />

      <button type="button" className="rt-coming" onClick={() => setComposing(true)}>
        <span>{t.comingUp}</span>
        <i>
          <Icon name="arrow" />
        </i>
      </button>

      {composing ? <ComingUp onSend={(m) => void send(m)} onClose={() => setComposing(false)} /> : null}
      {why ? <WhySheet ask={why.ask} about={why.about} onClose={() => setWhy(null)} /> : null}
    </main>
  );
}

/** Signed out: the same rules on what they told us, nothing stored, and a way to keep it. */
export function RitualPreviewTab() {
  const { ready, progress } = useProgress();
  useRefreshOnReturn(ready && progress.member);
  const [parts, setParts] = useState<readonly RitualPart[] | null>(null);
  const now = useNow();
  const [selected, setSelected] = useState<string | null>(null);
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    previewRitual(progress, Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((p) => alive && setParts(p.parts))
      .catch(() => alive && setParts([]));
    return () => {
      alive = false;
    };
  }, [ready, progress]);
  const today = now ? now.toLocaleDateString('en-CA') : null;
  const week = useMemo(() => {
    if (!today || !parts) return [];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(`${today}T12:00:00Z`);
      d.setUTCDate(d.getUTCDate() + i);
      const date = d.toISOString().slice(0, 10);
      return { date, parts: partsOn(parts, date) };
    });
  }, [today, parts]);
  const shown = week.find((d) => d.date === selected) ?? week[0];
  return (
    <main className="tb-page">
      <Header date={shown?.date ?? today} name={progress.name} />
      {/* Signed out, keeping it comes first: joined and waiting on the email link, or not yet in. */}
      {ready ? (
        <section className="ds-card rt-signin rt-signin--top" aria-label={progress.member ? t.lastStep : t.signIn}>
          {progress.member ? <h2>{t.lastStep}</h2> : null}
          <p>{progress.member ? t.lastStepLine : t.signedOut}</p>
          <Link className="ds-primary" href="/sign-in">
            {progress.member ? t.sendAgain : t.signIn}
            <Arrow />
          </Link>
        </section>
      ) : null}
      {!parts || !shown || !today ? (
        <div className="tb-wait">
          <i />
          <i />
        </div>
      ) : (
        <>
          <Week days={week} today={today} selected={shown.date} onPick={setSelected} />
          <h2 className="rt-day-head">{shown.date === today ? t.today : longDate(shown.date)}</h2>
          <Timeline parts={shown.parts} />
          <AnyDay parts={parts} />
        </>
      )}
    </main>
  );
}
