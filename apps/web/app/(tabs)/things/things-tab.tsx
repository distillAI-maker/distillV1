'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RitualPart } from '@distill/engine/ritual';
import { Icon } from '../../../components/ds/icons';
import { Sheet } from '../../../components/ds/sheet';
import { Locked, Mark } from '../../../components/ds/ui';
import { useNames } from '../../../components/ds/use-names';
import { copy } from '../../../lib/copy';
import { engineApi, type EngineState } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { previewRitual } from '../../../lib/engine/preview';
import { withAbout } from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';
import { newItemId, type Progress, type StackItem } from '../../../lib/progress/types';
import { whenLine } from '../../../lib/ritual-groups';
import { whyLine } from '../../../lib/ritual-lines';
import { track } from '../../../lib/track';
import { WhySheet } from '../ritual/ritual-tab';

const t = copy.things;
const money = (n: number) => Math.round(n).toLocaleString('en-US');
type Standing = 'clinician' | 'theirs' | 'keep' | 'clear' | 'adjust' | 'open';
type Thread = EngineState['thread'];

/** Where each thing stands, and the part it has in their Ritual: from the engine, or the same rules on this phone. */
function useStandings() {
  const { ready, progress } = useProgress();
  const engine = useEngine();
  const [local, setLocal] = useState<{ standings: Record<string, string>; parts: readonly RitualPart[] } | null>(null);
  const listKey = JSON.stringify(progress.items.map((i) => [i.id, i.status, i.origin ?? null]));
  useEffect(() => {
    if (!ready || engine.on) return;
    let alive = true;
    previewRitual(progress, Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((p) => alive && setLocal({ standings: p.standings as Record<string, string>, parts: p.parts }))
      .catch(() => alive && setLocal({ standings: {}, parts: [] }));
    return () => {
      alive = false;
    };
    // Runs again only when their list changes.
  }, [ready, engine.on, listKey]);
  const live = engine.on ? engine.state : null;
  const parts = useMemo(() => {
    if (!live) return local?.parts ?? [];
    const seen = new Map<string, RitualPart>();
    for (const d of live.ritual.week) for (const p of d.parts) if (!seen.has(p.id)) seen.set(p.id, p);
    return [...seen.values()];
  }, [live, local]);
  return { standings: (live?.items ?? local?.standings ?? {}) as Record<string, Standing>, parts, live, loaded: !!live || !!local };
}

/** A thing's note, and Distill's reply to it: the companion message right after the same words. */
function replyTo(note: string, thread: Thread | undefined): string | undefined {
  if (!thread) return undefined;
  const at = thread.findIndex((m) => m.role === 'person' && m.text === note);
  const next = at >= 0 ? thread[at + 1] : undefined;
  return next?.role === 'companion' ? next.text : undefined;
}

/** "What Distill knows": the people, places and things they told us, as chips they can correct. */
function Knows() {
  const { progress, update } = useProgress();
  const [editing, setEditing] = useState<string | null>(null);
  const lines = progress.picture?.lines ?? [];
  function remove(id: string) {
    update((p) => {
      const line = p.picture?.lines.find((l) => l.id === id);
      if (!p.picture || !line) return p;
      const next: Progress = {
        ...p,
        picture: {
          lines: p.picture.lines.filter((l) => l.id !== id),
          removed: [...p.picture.removed, line.text].slice(-100),
          updatedAt: new Date().toISOString(),
        },
      };
      return withAbout(next);
    });
    track('picture_changed');
    setEditing(null);
  }
  return (
    <section className="ds-card th-knows" id="knows" aria-label={t.knows}>
      <div className="tb-section-head">
        <h2>{t.knows}</h2>
        {lines.length ? <span>{t.knowsHint}</span> : null}
      </div>
      {lines.length ? (
        <>
          <div className="ds-bubbles">
            {lines.map((l) => (
              <button
                key={l.id}
                type="button"
                className={`ds-bubble${editing === l.id ? ' is-editing' : ''}`}
                aria-expanded={editing === l.id}
                onClick={() => setEditing(editing === l.id ? null : l.id)}
              >
                {l.text}
              </button>
            ))}
          </div>
          {editing ? (
            <div className="rt-reply-actions">
              <button type="button" className="ds-bubble" onClick={() => setEditing(null)}>
                {t.knowsRight}
              </button>
              <button type="button" className="ds-bubble" onClick={() => remove(editing)}>
                {t.knowsRemove}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="th-knows-empty">{t.knowsEmpty}</p>
      )}
    </section>
  );
}

/** One thing: where it sits in their Ritual and why, the notes between them and Distill, and their say. */
function ThingSheet({
  item,
  name,
  part,
  standing,
  thread,
  onClose,
}: {
  item: StackItem;
  name: string;
  part: RitualPart | undefined;
  standing: Standing | undefined;
  thread: Thread | undefined;
  onClose: () => void;
}) {
  const { progress, update } = useProgress();
  const engine = useEngine();
  const [draft, setDraft] = useState('');
  const [why, setWhy] = useState(false);
  const decision = engine.state?.decisions.find(
    (d) => d.stackItemId === item.id && d.kind === 'clear' && d.status === 'proposed',
  );
  const cut = item.status === 'cut';
  const theirs = part?.lock === 'theirs' || standing === 'theirs' || item.status === 'kept';

  function send() {
    const text = draft.trim().slice(0, 4000);
    if (!text) return;
    setDraft('');
    track('note_written');
    const next: Progress = {
      ...progress,
      items: progress.items.map((i) =>
        i.id === item.id ? { ...i, notes: [...i.notes, { id: newItemId(), text, at: new Date().toISOString() }] } : i,
      ),
    };
    update(next);
    // Signed in, Distill reads it as being about this thing, learns from it, and replies.
    if (engine.on) void engine.act(() => engineApi.message(text, item.id), { save: next });
  }
  function answer(choice: 'yes' | 'theirs') {
    if (!decision) return;
    const next: Progress = {
      ...progress,
      items: progress.items.map((i) => (i.id === item.id ? { ...i, status: choice === 'yes' ? 'cut' : 'kept' } : i)),
    };
    update(next);
    void engine.act(() => engineApi.run({ kind: 'decision-answer', decisionId: decision.id, answer: choice }), { save: next });
  }

  const where = cut ? t.letGoState : part ? whenLine(part.when) : decision ? t.suggested : t.stillYours;
  const line = cut
    ? item.monthlyCost
      ? t.perMonthBack(money(item.monthlyCost))
      : ''
    : decision
      ? t.suggestedLine
      : part
        ? whyLine(part)
        : '';

  return (
    <Sheet eyebrow={t.sheetEyebrow} title={name} closeLabel={t.close} onClose={onClose}>
      <section className="ds-card th-why">
        <span className="ds-eyebrow">{t.inYourRitual}</span>
        <strong>{where}</strong>
        {line ? <p>{line}</p> : null}
        {theirs ? <Locked>{copy.ritualTab.yours}</Locked> : part?.lock === 'clinician' ? <Locked>{copy.ritualTab.clinician}</Locked> : null}
      </section>
      <section className="th-notes" aria-label={t.notesTitle}>
        <span className="ds-eyebrow">{t.notesTitle}</span>
        {item.notes.length ? (
          item.notes.map((n) => {
            const reply = replyTo(n.text, thread);
            return (
              <div key={n.id}>
                <p className="th-note-you">{n.text}</p>
                {reply ? (
                  <div className="th-note-distill">
                    <Mark size="sm" />
                    <p>{reply}</p>
                  </div>
                ) : null}
              </div>
            );
          })
        ) : (
          <p className="th-note-empty">{engine.on ? t.notesEmpty : t.notesSignedOut}</p>
        )}
        {engine.busy && item.notes.length ? (
          <div className="th-note-distill" aria-live="polite">
            <Mark size="sm" turning />
            <p style={{ color: 'var(--muted)' }}>{t.replying}</p>
          </div>
        ) : null}
      </section>
      <form
        className="th-note-input"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label className="sr-only" htmlFor={`note-${item.id}`}>
          {t.notePlaceholder}
        </label>
        <input id={`note-${item.id}`} value={draft} maxLength={4000} placeholder={t.notePlaceholder} onChange={(e) => setDraft(e.target.value)} />
        <button type="submit" disabled={!draft.trim() || engine.busy}>
          {t.send}
        </button>
      </form>
      {engine.on ? (
        <div className="th-actions">
          <button type="button" className="ds-link" onClick={() => setWhy(true)}>
            {copy.decide.why}
          </button>
          {decision && !theirs ? (
            <>
              <button type="button" className="ds-link" disabled={engine.busy} onClick={() => answer('yes')}>
                {copy.decide.yes.clear}
              </button>
              <button type="button" className="ds-link" disabled={engine.busy} onClick={() => answer('theirs')}>
                {copy.decide.mine}
              </button>
            </>
          ) : null}
        </div>
      ) : null}
      {why ? (
        <WhySheet
          ask={copy.companion.why[cut || decision ? 'clear' : theirs ? 'keep' : 'other'](name)}
          about={item.id}
          onClose={() => setWhy(false)}
        />
      ) : null}
    </Sheet>
  );
}

/** Your things: what Distill knows, the money back, everything they do, and what's let go. */
export function ThingsTab() {
  const { ready, progress } = useProgress();
  const { nameOf } = useNames();
  const { standings, parts, live, loaded } = useStandings();
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);

  const items = progress.items.filter((i) => !i.dataSource);
  const partOf = (id: string) => parts.find((p) => p.source.kind === 'stack' && p.source.stackItemId === id && p.status === 'active');
  const letGo = items.filter((i) => i.status === 'cut');
  const kept = items.filter((i) => i.status !== 'cut');
  const inRitual = kept.filter((i) => partOf(i.id) || standings[i.id] === 'clear');
  const whenNeeded = kept.filter((i) => !partOf(i.id) && standings[i.id] !== 'clear');
  const back = live?.money.back || letGo.reduce((s, i) => s + i.monthlyCost, 0);

  const tone = (i: StackItem) => {
    const s = standings[i.id];
    const p = partOf(i.id);
    if (s === 'clear') return 'quiet';
    if (p?.lock === 'theirs' || s === 'theirs' || i.status === 'kept' || progress.dayOne.yours.includes(i.id)) return 'ink';
    if (s === 'keep' || p?.lock === 'clinician' || s === 'clinician') return 'olive';
    return 'paper';
  };
  const openItem = items.find((i) => i.id === open);

  return (
    <main className="tb-page">
      <header className="tb-header">
        <div>
          <span>{t.eyebrow}</span>
          <h1>{t.title}</h1>
        </div>
        <Mark />
      </header>

      <Knows />

      {back > 0 ? (
        <section className="th-money" aria-label={t.moneyBack}>
          <div>
            <span>{t.moneyBack}</span>
            <strong>${money(back)}</strong>
            <small>{t.aMonth}</small>
          </div>
          <p>
            {t.released(letGo.length || 1)}
            <br />
            {t.moreRoom}
          </p>
        </section>
      ) : (
        <div style={{ height: 26 }} />
      )}

      {!ready || !loaded ? (
        <div className="tb-wait">
          <i />
          <i />
        </div>
      ) : !items.length ? (
        <p className="rt-empty">{t.empty}</p>
      ) : (
        <>
          {inRitual.length ? (
            <section aria-label={t.inRitual}>
              <div className="tb-section-head">
                <h2>{t.inRitual}</h2>
                <span>{t.count(inRitual.length)}</span>
              </div>
              <div className="th-grid">
                {inRitual.map((i) => {
                  const p = partOf(i.id);
                  const suggested = standings[i.id] === 'clear';
                  return (
                    <button key={i.id} type="button" className={`th-tile th-tile--${tone(i)}`} onClick={() => setOpen(i.id)}>
                      {suggested ? <i>{t.suggested}</i> : null}
                      <strong>{nameOf(i.id)}</strong>
                      <span>{p ? whenLine(p.when) : i.monthlyCost ? t.perMonth(money(i.monthlyCost)) : ''}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {whenNeeded.length ? (
            <section className="th-group" aria-label={t.whenNeeded}>
              <div className="tb-section-head">
                <h2>{t.whenNeeded}</h2>
                <span>{t.whenNeededHint}</span>
              </div>
              {whenNeeded.map((i) => (
                <button key={i.id} type="button" className="th-row th-row--paper" onClick={() => setOpen(i.id)}>
                  <div>
                    <strong>{nameOf(i.id)}</strong>
                    <span>{t.whenNeededLine}</span>
                  </div>
                  <Icon name="arrow" />
                </button>
              ))}
            </section>
          ) : null}

          {letGo.length ? (
            <section className="th-group" aria-label={t.letGo}>
              <div className="tb-section-head">
                <h2>{t.letGo}</h2>
                <span>{t.letGoHint}</span>
              </div>
              {letGo.map((i) => (
                <button key={i.id} type="button" className="th-row" onClick={() => setOpen(i.id)}>
                  <div>
                    <strong>{nameOf(i.id)}</strong>
                    {i.monthlyCost ? <span>{t.perMonthBack(money(i.monthlyCost))}</span> : null}
                  </div>
                  <Icon name="arrow" />
                </button>
              ))}
            </section>
          ) : null}
        </>
      )}

      {openItem ? (
        <ThingSheet
          item={openItem}
          name={nameOf(openItem.id)}
          part={partOf(openItem.id)}
          standing={standings[openItem.id]}
          thread={live?.thread}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </main>
  );
}
