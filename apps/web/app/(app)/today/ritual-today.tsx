'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { RitualPart } from '@distill/engine/ritual';
import { Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { engineApi, type EngineState } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { previewRitual } from '../../../lib/engine/preview';
import { useProgress } from '../../../lib/progress/context';
import home from '../home/home.module.css';
import s from './today.module.css';

type DayOut = EngineState['ritual']['today'];
type Part = DayOut['parts'][number];
export type View = 'morning' | 'night' | 'weekend';

const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const isWeekend = (date: string) => weekday(date) === 0 || weekday(date) === 6;
const dayName = (date: string) =>
  new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });

function clock(at: string) {
  const [h = 0, m = 0] = at.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

/** When a part happens, for the time column; a time of day the heading already says is left out. */
export function whenOf(p: Pick<RitualPart, 'when'>, implied: readonly RitualPart['when']['slot'][] = []) {
  if (p.when.at) return clock(p.when.at);
  if (p.when.perWeek && !p.when.days.length) return copy.days.perWeek(p.when.perWeek);
  return implied.includes(p.when.slot) ? '' : copy.days.slots[p.when.slot];
}

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

/** A base week's parts as the person reads a draft: mornings, nights, and what is weekend-only. */
function groupsOf(parts: readonly RitualPart[]) {
  const active = parts.filter((p) => p.status === 'active');
  const weekendOnly = (p: RitualPart) => p.when.days.length > 0 && p.when.days.every((d) => d === 'sat' || d === 'sun');
  const morning = (p: RitualPart) => p.when.slot === 'morning' || p.when.slot === 'midday';
  return [
    { key: 'morning', label: copy.days.views.morning, implied: ['morning'] as const, parts: active.filter((p) => !weekendOnly(p) && morning(p)) },
    { key: 'night', label: copy.days.views.night, implied: ['night'] as const, parts: active.filter((p) => !weekendOnly(p) && !morning(p)) },
    { key: 'weekend', label: copy.days.views.weekend, implied: [] as const, parts: active.filter(weekendOnly) },
  ].filter((g) => g.parts.length);
}

function todayLabel() {
  const d = new Date();
  return `${d.toLocaleDateString('en-GB', { weekday: 'long' })} · ${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}`;
}

function PartLine({
  part,
  actions,
  implied,
}: {
  part: RitualPart;
  actions?: React.ReactNode;
  implied?: readonly RitualPart['when']['slot'][];
}) {
  const when = whenOf(part, implied);
  const meta = [
    part.minutes ? copy.days.minutes(part.minutes) : null,
    part.lock === 'theirs' ? copy.days.yours : part.lock === 'clinician' ? copy.days.clinician : null,
  ].filter(Boolean);
  return (
    <li className={s.part}>
      <span className={s.time}>{when}</span>
      <span className={s.body}>
        <span className={s.ptitle}>{part.title}</span>
        {meta.length ? <span className={s.pmeta}>{meta.join(' · ')}</span> : null}
        {part.why ? <span className={s.why}>{part.why}</span> : null}
      </span>
      {actions}
    </li>
  );
}

function Draft({ parts }: { parts: readonly RitualPart[] }) {
  return (
    <>
      {groupsOf(parts).map((g) => (
        <section key={g.key} className={s.day} aria-label={g.label}>
          <p className={home.eyebrow}>{g.label}</p>
          <ul className={s.parts}>
            {g.parts.map((p) => (
              <PartLine key={p.id} part={p} implied={g.implied} />
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

/** Tell Distill what's coming up. The reply shows here; the whole thread lives at /companion. */
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
    <section className={s.composer} aria-label={copy.days.tell}>
      <p className={home.eyebrow}>{copy.days.tell}</p>
      <p className={s.lede}>{copy.days.tellLine}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          aria-label={copy.companion.label}
          rows={2}
          maxLength={2000}
          value={text}
          placeholder={copy.companion.placeholder}
          onChange={(e) => setText(e.target.value)}
        />
        <div className={home.actions}>
          <button type="submit" className={home.primary} disabled={busy || !text.trim()}>
            {busy ? copy.companion.sending : copy.companion.send}
          </button>
          <Link className={s.threadLink} href="/companion">
            {copy.companion.title} →
          </Link>
        </div>
      </form>
      {reply ? (
        <p className={s.reply} aria-live="polite">
          {reply}
        </p>
      ) : null}
    </section>
  );
}

/** Today: today's Ritual, a change to undo or keep, and a place to say what's coming up. */
export function RitualToday() {
  const { state, error, busy, act } = useEngine();
  const { progress } = useProgress();
  const [view, setView] = useState<View | null>(null);

  if (!state)
    return (
      <section className={home.page} aria-busy={!error}>
        <h1 className="sr-only">{copy.days.title}</h1>
        {error ? (
          <p className="notice" role="alert">
            {copy.days.error}
          </p>
        ) : (
          <Skeleton kind="title" count={2} />
        )}
      </section>
    );

  const r = state.ritual;
  if (r.status === 'none')
    return (
      <section className={home.page} aria-busy="true">
        <p className={home.eyebrow}>{copy.days.shaping}</p>
        <Skeleton kind="title" count={2} />
      </section>
    );

  if (r.status === 'proposed' && r.proposed)
    return (
      <div className={home.page}>
        <p className={home.dateLabel}>{copy.days.title}</p>
        <h1 className={s.title}>{copy.days.proposedTitle}</h1>
        <p className={s.lede}>{r.summary || copy.days.proposedLine}</p>
        <Draft parts={r.proposed.parts} />
        {error ? (
          <p className="notice" role="alert">
            {copy.days.error}
          </p>
        ) : null}
        <div className={home.actions}>
          <button
            type="button"
            className={home.primary}
            disabled={busy}
            onClick={() => void act(() => engineApi.accept(r.proposed!.id))}
          >
            {copy.days.accept}
          </button>
          <Link className={`${home.secondary} ${s.buttonLink}`} href="/companion">
            {copy.days.change}
          </Link>
        </div>
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
    <div className={home.page}>
      <p className={home.dateLabel}>{todayLabel()}</p>
      <h1 className={s.title}>{copy.days.title}</h1>

      {error ? (
        <p className="notice" role="alert">
          {copy.days.error}
        </p>
      ) : null}

      {change ? (
        <section className={s.change} aria-live="polite">
          <p className={home.eyebrow}>
            {change.scope === 'day' ? copy.days.adjusted(dayName(change.date)) : copy.days.weekAdjusted}
          </p>
          <p>{change.reply}</p>
          <button
            type="button"
            className={home.link}
            disabled={busy}
            onClick={() => void act(() => engineApi.undo(change.versionId))}
          >
            {copy.days.undo}
          </button>
        </section>
      ) : null}

      {ongoing ? (
        <section className={s.change}>
          <p className={home.eyebrow}>{copy.days.proposalTitle}</p>
          {ongoing.reply ? <p>{ongoing.reply}</p> : null}
          <div className={home.actions}>
            <button
              type="button"
              className={home.primary}
              disabled={busy}
              onClick={() => void act(() => engineApi.accept(ongoing.id))}
            >
              {copy.days.keepChange}
            </button>
            <button
              type="button"
              className={home.secondary}
              disabled={busy}
              onClick={() => void act(() => engineApi.undo(ongoing.id))}
            >
              {copy.days.notNow}
            </button>
          </div>
        </section>
      ) : null}

      <div className={s.views} role="tablist" aria-label={copy.days.viewsLabel}>
        {(['morning', 'night', 'weekend'] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={v === k}
            className={v === k ? `${s.view} ${s.viewOn}` : s.view}
            onClick={() => setView(k)}
          >
            {copy.days.views[k]}
          </button>
        ))}
      </div>

      {days.map((d) => (
        <section key={d.date} className={s.day} aria-label={d.label}>
          <p className={home.eyebrow}>{d.label}</p>
          {d.parts.length ? (
            <ul className={s.parts}>
              {d.parts.map((p) => (
                <PartLine
                  key={p.id}
                  part={p}
                  implied={v === 'weekend' ? [] : [v]}
                  actions={
                    d.date === today ? (
                      <span className={s.checks} role="group" aria-label={p.title}>
                        <button
                          type="button"
                          aria-pressed={p.check === 'done'}
                          className={p.check === 'done' ? s.checkOn : s.check}
                          disabled={busy}
                          onClick={() => check(p, d.date, true)}
                        >
                          {copy.days.done}
                        </button>
                        <button
                          type="button"
                          aria-pressed={p.check === 'skipped'}
                          className={p.check === 'skipped' ? s.checkOn : s.check}
                          disabled={busy}
                          onClick={() => check(p, d.date, false)}
                        >
                          {copy.days.skip}
                        </button>
                      </span>
                    ) : undefined
                  }
                />
              ))}
            </ul>
          ) : (
            <p className={s.empty}>{copy.days.empty}</p>
          )}
        </section>
      ))}

      <Composer />

      {progress.dayOne.started ? (
        <Link className={home.link} href="/today/reading">
          {copy.days.readings} →
        </Link>
      ) : null}
    </div>
  );
}

/** Signed out: the same rules on what they typed, nothing stored, and a way to keep it. */
export function RitualPreview() {
  const { ready, progress } = useProgress();
  const [parts, setParts] = useState<readonly RitualPart[] | null>(null);
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
  return (
    <div className={home.page}>
      <p className={home.dateLabel}>{copy.days.title}</p>
      <h1 className={s.title}>{copy.days.proposedTitle}</h1>
      <p className={s.lede}>{copy.days.signedOut}</p>
      {parts ? <Draft parts={parts} /> : <Skeleton kind="option" count={3} />}
      <div className={home.actions}>
        <Link className={`${home.primary} ${s.buttonLink}`} href="/sign-in">
          {copy.days.signIn}
        </Link>
      </div>
    </div>
  );
}
