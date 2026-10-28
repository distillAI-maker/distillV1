'use client';

import { useEffect, useState } from 'react';
import type { QuestionOption } from '@distill/engine/ritual';
import { Arrow, Bubble, Mark } from '../../../components/ds/ui';
import { relearn } from '../../../lib/ai/companion-client';
import { commonRow, morePlaces, type CommonItem } from '../../../lib/catalog/common';
import { copy } from '../../../lib/copy';
import type { RoutedStack } from '../../../lib/data/types';
import { exampleFor } from '../../../lib/daily';
import { engineApi, type EngineState } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { useProgress } from '../../../lib/progress/context';
import { newItemId, type Progress } from '../../../lib/progress/types';
import { track } from '../../../lib/track';

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const t = copy.ritualTab;

export type WhyKind = 'clear' | 'swap' | 'keep' | 'question' | 'other';

/**
 * One card a day, chosen by the engine: something to let go of (said firmly once, with the money
 * back), a small change, a question whose answer changes what Distill does, a place to look for
 * things we haven't seen, a question about them, or, once the noise is gone, what to try next.
 * Answering closes the card to "That's all for today."
 */
export function DailyCard({
  state,
  routed,
  nameOf,
  onWhy,
}: {
  state: EngineState;
  routed: RoutedStack | null;
  nameOf: (id: string | null | undefined) => string;
  onWhy: (stackItemId: string, kind: WhyKind) => void;
}) {
  const { progress, update } = useProgress();
  const { act, busy } = useEngine();
  const today = state.today;
  // The swap stays on the card after they answer it, so they see "Added" before it goes.
  const [swap, setSwap] = useState(today.swap);
  const [swapSaid, setSwapSaid] = useState<'add' | 'decline' | null>(null);
  useEffect(() => {
    if (today.swap) setSwap(today.swap);
  }, [today.swap]);

  const withItem = (id: string, change: Partial<Progress['items'][number]>): Progress => ({
    ...progress,
    items: progress.items.map((i) => (i.id === id ? { ...i, ...change } : i)),
  });

  const done = (line?: string) => (
    <>
      {line ? (
        <section className="rt-daily rt-daily--light" aria-live="polite">
          <h2>{line}</h2>
          {swapOffer}
        </section>
      ) : null}
      <p className="rt-done">{t.allDone}</p>
    </>
  );

  const offer = today.swap ?? (swap && swap.stackItemId === today.decision?.stackItemId ? swap : undefined);
  const swapOffer = offer ? (
    <div className="rt-idea" aria-live="polite">
      <span className="ds-eyebrow">{copy.swap.ask}</span>
      <p style={{ marginTop: 4 }}>
        <strong>{offer.title}</strong> · {copy.swap.when(offer.perWeek, offer.slot)}
      </p>
      {swapSaid ? (
        <p style={{ marginTop: 8, color: 'var(--muted)' }}>{swapSaid === 'add' ? copy.swap.added : copy.swap.declined}</p>
      ) : (
        <div className="rt-daily-actions">
          <button
            type="button"
            className="ds-spark"
            disabled={busy}
            onClick={async () => {
              if (await act(() => engineApi.swapAnswer(offer.itemKey, 'add'))) setSwapSaid('add');
            }}
          >
            {copy.swap.add}
          </button>
          <button
            type="button"
            className="ds-link"
            disabled={busy}
            onClick={async () => {
              if (await act(() => engineApi.swapAnswer(offer.itemKey, 'decline'))) setSwapSaid('decline');
            }}
          >
            {copy.swap.no}
          </button>
        </div>
      )}
    </div>
  ) : null;

  // A decision: let it go, a small change, worth keeping, one for a professional.
  if (today.decision) {
    const d = today.decision;
    const kind = today.kind ?? 'keep';
    if (d.status !== 'proposed')
      return done(
        d.status === 'yes' && d.reason === 'BUDGET'
          ? copy.decide.budgeted
          : d.status === 'yes' && d.kind === 'clear' && d.reason === 'UNLOVED_HABIT'
            ? copy.decide.swapped
            : d.status === 'yes' && d.kind === 'clear'
              ? copy.decide.letGone(money(d.money))
              : d.status === 'theirs'
                ? copy.decide.kept
                : d.status === 'not-now'
                  ? copy.decide.later
                  : copy.decide.thanks,
      );
    const answer = (choice: 'yes' | 'not-now' | 'theirs') => {
      const run = () => engineApi.run({ kind: 'decision-answer', decisionId: d.id, answer: choice });
      // Their list is theirs to change, so the app records a let-go or a "mine" before the engine runs.
      // A swap keeps the habit on their list, done a little differently.
      if (d.stackItemId && choice === 'yes' && d.kind === 'clear' && d.reason !== 'UNLOVED_HABIT') {
        const next = withItem(d.stackItemId, { status: 'cut' });
        update(next);
        return void act(run, { save: next });
      }
      // A yes to "next to your morning coffee" anchors it: the Ritual then has it there, every day.
      if (d.stackItemId && choice === 'yes' && d.reason === 'PAIR') {
        const item = progress.items.find((i) => i.id === d.stackItemId);
        const next = withItem(d.stackItemId, { answers: { ...(item?.answers ?? {}), paired: true } });
        update(next);
        return void act(run, { save: next });
      }
      if (d.stackItemId && choice === 'theirs') {
        const next = withItem(d.stackItemId, { status: 'kept' });
        update(next);
        return void act(run, { save: next });
      }
      void act(run);
    };
    const yes = (d.reason === 'UNLOVED_HABIT' ? copy.decide.yes.swap : copy.decide.yes[kind]) ?? copy.decide.yes.keep;
    const clear = kind === 'clear';
    return (
      <section className="rt-daily" aria-label={t.thought}>
        <div className="rt-daily-top">
          <span className="ds-eyebrow">{t.thought}</span>
          <Mark size="sm" light />
        </div>
        <h2>{nameOf(d.stackItemId) || t.thought}</h2>
        <p>{d.line}</p>
        <div className="rt-daily-actions">
          <button type="button" className={clear ? 'ds-spark' : 'ds-primary ds-primary--light'} style={clear ? undefined : { width: 'auto' }} disabled={busy} onClick={() => answer('yes')}>
            {yes}
          </button>
          {d.stackItemId ? (
            <button
              type="button"
              className="ds-link"
              onClick={() => onWhy(d.stackItemId!, clear ? (d.reason === 'UNLOVED_HABIT' ? 'swap' : 'clear') : kind === 'keep' ? 'keep' : 'other')}
            >
              {copy.decide.why}
            </button>
          ) : null}
        </div>
        {clear ? (
          // Their answer still decides: quieter, never hidden.
          <div className="rt-quiet">
            <button type="button" disabled={busy} onClick={() => answer('not-now')}>
              {copy.decide.notNow}
            </button>
            <i />
            <button type="button" disabled={busy} onClick={() => answer('theirs')}>
              {copy.decide.mine}
            </button>
          </div>
        ) : kind === 'adjust' || kind === 'curate' ? (
          <div className="rt-quiet">
            <button type="button" disabled={busy} onClick={() => answer('not-now')}>
              {copy.decide.notNow}
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  // A question whose answer changes what Distill does.
  if (today.kind === 'question') {
    const q = today.question;
    if (!q) return done();
    const pick = (option: QuestionOption) => {
      const base = { kind: 'question-answer' as const, questionId: q.id, label: option.label };
      const patch = option.patch;
      // "Not sure" changes nothing they told us; the engine just rests the question.
      if (patch.kind === 'unsure') return void act(() => engineApi.run(base));
      if (patch.kind === 'attachment')
        return void act(() => engineApi.run({ ...base, attachment: patch.attachment, stackItemId: patch.stackItemId }));
      const item = progress.items.find((i) => i.id === patch.stackItemId);
      if (!item) return;
      const next =
        patch.kind === 'answers'
          ? withItem(item.id, { answers: { ...item.answers, ...patch.set } })
          : withItem(item.id, { origin: patch.origin });
      update(next);
      void act(() => engineApi.run(base), { save: next });
    };
    return (
      <section className="rt-daily rt-daily--light" aria-label={t.question}>
        <div className="rt-daily-top">
          <span className="ds-eyebrow">{t.question}</span>
          <Mark size="sm" />
        </div>
        <h2>{q.text}</h2>
        <div className="ds-bubbles">
          {q.options.map((o) => (
            <Bubble key={o.label} on={false} onClick={() => !busy && pick(o)}>
              {o.label}
            </Bubble>
          ))}
        </div>
        <button type="button" className="ds-link" onClick={() => onWhy(q.stackItemId, 'question')}>
          {copy.decide.why}
        </button>
      </section>
    );
  }

  // Anything by your bed, in your bag, in the kitchen we haven't seen?
  if (today.kind === 'more' && today.more) return <MoreCard placeId={today.more} />;

  // A question about them, answered in their own words.
  if (today.kind === 'learn' && today.learn) return <LearnCard question={today.learn} routed={routed} />;

  // Once the noise is gone: what they'd like to try. Explore holds it in full.
  if (today.kind === 'explore')
    return (
      <section className="rt-daily rt-daily--light">
        <div className="rt-daily-top">
          <span className="ds-eyebrow">{t.thought}</span>
          <Mark size="sm" />
        </div>
        <h2>{copy.explore.ask}</h2>
        <p>{copy.explore.line}</p>
        <div className="rt-daily-actions">
          <a className="ds-primary" href="/explore" style={{ width: 'auto' }}>
            {copy.shell.tabs.explore}
            <Arrow />
          </a>
        </div>
      </section>
    );

  return done();
}

/** "Anything by your bed or in your bathroom cabinet we haven't seen?" Taps add to their list. */
function MoreCard({ placeId }: { placeId: string }) {
  const { progress, update } = useProgress();
  const [other, setOther] = useState('');
  const todayKey = new Date().toLocaleDateString('en-CA');
  const place = morePlaces.find((p) => p.id === placeId);
  // The card keeps its own day in progress, so what they added shows as chosen until tomorrow.
  useEffect(() => {
    if (progress.daily?.date === todayKey && progress.daily.kind === 'more' && progress.daily.ref === placeId) return;
    update((p) => ({
      ...p,
      daily: { date: todayKey, kind: 'more', ref: placeId, done: false },
      moreAsked: [...new Set([...(p.moreAsked ?? []), placeId])],
    }));
  }, [placeId, todayKey, progress.daily, update]);
  if (!place) return null;
  const daily = progress.daily?.date === todayKey && progress.daily.ref === placeId ? progress.daily : undefined;
  const added = daily?.added ?? [];
  const items = progress.items;
  const inStack = new Set(items.map((i) => i.itemKey));
  const chips = place.items.filter((i) => !inStack.has(i.key) || added.includes(i.key));
  const own = items.filter((i) => added.includes(`id:${i.id}`));
  const setAdded = (p: Progress, next: string[]): Progress => (p.daily ? { ...p, daily: { ...p.daily, added: next } } : p);

  if (daily?.done)
    return (
      <>
        <section className="rt-daily rt-daily--light" aria-live="polite">
          <h2>{added.length ? copy.home.more.added(added.length, items.filter((i) => i.status !== 'cut').length) : copy.home.more.none}</h2>
        </section>
        <p className="rt-done">{t.allDone}</p>
      </>
    );

  function toggle(item: CommonItem) {
    update((p) => {
      const now = p.daily?.added ?? [];
      const there = p.items.find((i) => i.itemKey === item.key);
      if (there && now.includes(item.key))
        return setAdded({ ...p, items: p.items.filter((i) => i.id !== there.id) }, now.filter((k) => k !== item.key));
      if (there) return p;
      return setAdded({ ...p, items: [...p.items, commonRow(item, p.items.length)] }, [...now, item.key]);
    });
  }
  function addOther() {
    const name = other.trim().slice(0, 120);
    if (!name) return;
    const id = newItemId();
    update((p) =>
      setAdded(
        {
          ...p,
          items: [
            ...p.items,
            { id, itemKey: null, customName: name, monthlyCost: 0, answers: {}, chips: {}, unknown: [], status: 'listed', notes: [], position: p.items.length },
          ],
        },
        [...(p.daily?.added ?? []), `id:${id}`],
      ),
    );
    setOther('');
  }
  function removeOwn(id: string) {
    update((p) => setAdded({ ...p, items: p.items.filter((i) => i.id !== id) }, (p.daily?.added ?? []).filter((k) => k !== `id:${id}`)));
  }

  return (
    <section className="rt-daily rt-daily--light" aria-label={t.question}>
      <div className="rt-daily-top">
        <span className="ds-eyebrow">{t.question}</span>
        <Mark size="sm" />
      </div>
      <h2>{copy.home.more.ask[place.id]}</h2>
      <div className="ds-bubbles" role="group" aria-label={copy.home.more.ask[place.id]}>
        {chips.map((item) => (
          <Bubble key={item.key} on={added.includes(item.key)} onClick={() => toggle(item)}>
            {item.text}
          </Bubble>
        ))}
        {own.map((i) => (
          <Bubble key={i.id} on onClick={() => removeOwn(i.id)}>
            {i.customName}
          </Bubble>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          addOther();
        }}
      >
        <input
          className="rt-daily-input"
          aria-label={copy.home.more.otherLabel}
          placeholder={copy.home.more.other}
          maxLength={120}
          value={other}
          onChange={(e) => setOther(e.target.value)}
        />
      </form>
      <button
        type="button"
        className="ds-primary"
        onClick={() => {
          if (other.trim()) addOther();
          track('more_done', { place: place.id, added: added.length });
          update((p) => (p.daily ? { ...p, daily: { ...p.daily, done: true } } : p));
        }}
      >
        {copy.home.more.done}
        <Arrow />
      </button>
    </section>
  );
}

/** One question about who they are, answered in their own words. Distill learns from it. */
function LearnCard({ question, routed }: { question: string; routed: RoutedStack | null }) {
  const { progress, update } = useProgress();
  const engine = useEngine();
  const [answer, setAnswer] = useState('');
  const [said, setSaid] = useState(false);
  if (said || progress.asks.some((a) => a.q === question && Date.now() - Date.parse(a.at) < 86_400_000))
    return (
      <>
        <section className="rt-daily rt-daily--light" aria-live="polite">
          <h2>{copy.home.learnThanks}</h2>
        </section>
        <p className="rt-done">{t.allDone}</p>
      </>
    );
  return (
    <section className="rt-daily rt-daily--light" aria-label={t.question}>
      <div className="rt-daily-top">
        <span className="ds-eyebrow">{t.question}</span>
        <Mark size="sm" />
      </div>
      <h2>{question}</h2>
      <textarea
        className="rt-daily-input"
        style={{ marginTop: 14 }}
        aria-label={question}
        rows={3}
        maxLength={2000}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={exampleFor(question)}
      />
      <button
        type="button"
        className="ds-primary"
        disabled={!answer.trim()}
        onClick={() => {
          const ask = { q: question, a: answer.trim(), at: new Date().toISOString() };
          track('answer_given');
          update((p) => ({ ...p, asks: [...p.asks, ask] }));
          setSaid(true);
          if (engine.on) void engine.act(() => engineApi.run({ kind: 'answer', q: ask.q, a: ask.a }));
          if (routed) void relearn({ ...progress, asks: [...progress.asks, ask] }, routed, update);
        }}
      >
        {copy.home.learnSave}
        <Arrow />
      </button>
    </section>
  );
}
