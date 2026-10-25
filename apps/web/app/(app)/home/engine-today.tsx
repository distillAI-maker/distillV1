'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { QuestionOption } from '@distill/engine/ritual';
import { SwapCard } from '../../../components/swap-card';
import { copy } from '../../../lib/copy';
import type { RoutedStack } from '../../../lib/data/types';
import { engineApi, type EngineState } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { useProgress } from '../../../lib/progress/context';
import type { Progress } from '../../../lib/progress/types';

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/** Opens the companion asking why, about the thing on this card. */
function WhyLink({ stackItemId, ask }: { stackItemId: string; ask: 'clear' | 'keep' | 'question' | 'other' }) {
  return (
    <Link className="d-see-all d-see-all--quiet d-one-why" href={`/companion?about=${encodeURIComponent(stackItemId)}&why=${ask}`}>
      {copy.decide.why}
    </Link>
  );
}

/** The picks this card answers; 'more' and 'learn' use the home screen's own flows. */
export const ENGINE_CARDS = new Set(['clear', 'adjust', 'curate', 'keep', 'refer', 'celebrate', 'question', 'explore']);

/**
 * Today's one thing when the engine chose it: a decision to answer (let go, keep, adjust), a
 * question whose answer changes what Distill does, or, once the noise is gone, what to try next.
 */
export function EngineToday({ state, routed }: { state: EngineState; routed: RoutedStack }) {
  const { progress, update } = useProgress();
  const { act, busy, last } = useEngine();
  const [want, setWant] = useState('');
  const [region, setRegion] = useState('');
  const [answered, setAnswered] = useState<Record<string, 'add' | 'decline'>>({});
  const t = state.today;
  // The swap stays on the card after they answer it, so they see "Added" before it goes.
  const [swap, setSwap] = useState(t.swap);
  useEffect(() => {
    if (t.swap) setSwap(t.swap);
  }, [t.swap]);
  const offer = t.swap ?? (swap && swap.stackItemId === t.decision?.stackItemId ? swap : undefined);
  const nameOf = (id: string | null | undefined) =>
    (id && routed.items.find((r) => r.stackItemId === id)?.name) ||
    progress.items.find((i) => i.id === id)?.customName ||
    '';
  const withItem = (id: string, change: Partial<Progress['items'][number]>): Progress => ({
    ...progress,
    items: progress.items.map((i) => (i.id === id ? { ...i, ...change } : i)),
  });

  if (t.decision) {
    const d = t.decision;
    const kind = t.kind ?? 'keep';
    if (d.status !== 'proposed')
      return (
        <>
          <p className="d-sr">{copy.decide.eyebrow[kind] ?? copy.home.todayEyebrow}</p>
          <h2>
            {d.status === 'yes' && d.kind === 'clear'
              ? copy.decide.letGone(money(d.money))
              : d.status === 'theirs'
                ? copy.decide.kept
                : d.status === 'not-now'
                  ? copy.decide.later
                  : copy.decide.thanks}
          </h2>
          <p className="d-one-thing-done">{copy.home.doneToday}</p>
          {offer ? <SwapCard key={offer.itemKey} offer={offer} look="today" /> : null}
          {d.stackItemId && d.status === 'yes' && d.kind === 'clear' ? <WhyLink stackItemId={d.stackItemId} ask="other" /> : null}
        </>
      );
    const answer = (choice: 'yes' | 'not-now' | 'theirs') => {
      const run = () => engineApi.run({ kind: 'decision-answer', decisionId: d.id, answer: choice });
      // Their list is theirs to change, so the app records a let-go or a "mine" before the engine runs.
      if (d.stackItemId && choice === 'yes' && d.kind === 'clear') {
        const next = withItem(d.stackItemId, { status: 'cut' });
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
    return (
      <>
        <p className="d-sr">{copy.decide.eyebrow[kind] ?? copy.home.todayEyebrow}</p>
        <h2>{nameOf(d.stackItemId) || copy.home.todayEyebrow}</h2>
        <p>{d.line}</p>
        <div className="d-one-thing-actions">
          <button type="button" className="d-one-thing-btn d-one-thing-btn--go" disabled={busy} onClick={() => answer('yes')}>
            {copy.decide.yes[kind] ?? copy.decide.yes.keep}
          </button>
          {kind === 'clear' || kind === 'adjust' || kind === 'curate' ? (
            <button type="button" className="d-one-thing-btn" disabled={busy} onClick={() => answer('not-now')}>
              {copy.decide.notNow}
            </button>
          ) : null}
          {kind === 'clear' ? (
            <button type="button" className="d-one-thing-btn d-one-thing-btn--mine" disabled={busy} onClick={() => answer('theirs')}>
              {copy.decide.mine}
            </button>
          ) : null}
        </div>
        {d.stackItemId ? <WhyLink stackItemId={d.stackItemId} ask={kind === 'clear' ? 'clear' : kind === 'keep' ? 'keep' : 'other'} /> : null}
      </>
    );
  }

  if (t.kind === 'question') {
    const q = t.question;
    if (!q)
      return (
        <>
          <p className="d-sr">{copy.decide.eyebrow.question}</p>
          <h2>{copy.decide.thanks}</h2>
          <p className="d-one-thing-done">{copy.home.doneToday}</p>
        </>
      );
    const pick = (option: QuestionOption) => {
      const base = { kind: 'question-answer' as const, questionId: q.id, label: option.label };
      const patch = option.patch;
      // "Not sure" changes nothing they told us; the engine just rests the question.
      if (patch.kind === 'unsure') return void act(() => engineApi.run(base));
      if (patch.kind === 'attachment')
        return void act(() =>
          engineApi.run({ ...base, attachment: patch.attachment, stackItemId: patch.stackItemId }),
        );
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
      <>
        <p className="d-sr">{copy.decide.eyebrow.question}</p>
        <h2>{q.text}</h2>
        <div className="d-one-thing-actions">
          {q.options.map((o, i) => (
            <button
              key={o.label}
              type="button"
              className={`d-one-thing-btn${i === 0 ? ' d-one-thing-btn--go' : ''}`}
              disabled={busy}
              onClick={() => pick(o)}
            >
              {o.label}
            </button>
          ))}
        </div>
        <WhyLink stackItemId={q.stackItemId} ask="question" />
      </>
    );
  }

  if (t.kind === 'explore') {
    const options = last?.explore?.options;
    if (options)
      return (
        <>
          <p className="d-sr">{copy.home.todayEyebrow}</p>
          {last?.reply ? <h2>{last.reply}</h2> : null}
          <ul className="d-one-ideas">
            {options.map((o) => (
              <li key={o.ideaId}>
                <strong>{o.title}</strong>
                <p>{o.why}</p>
                {answered[o.ideaId] ? (
                  <p className="d-one-thing-done">{answered[o.ideaId] === 'add' ? copy.explore.added : copy.explore.declined}</p>
                ) : (
                  <div className="d-one-thing-actions">
                    <button
                      type="button"
                      className="d-one-thing-btn d-one-thing-btn--go"
                      disabled={busy}
                      onClick={async () => {
                        const r = await act(() => engineApi.exploreAnswer(o.ideaId, 'add'));
                        if (r) setAnswered((a) => ({ ...a, [o.ideaId]: 'add' }));
                      }}
                    >
                      {copy.explore.add}
                    </button>
                    <button
                      type="button"
                      className="d-one-thing-btn"
                      disabled={busy}
                      onClick={async () => {
                        const r = await act(() => engineApi.exploreAnswer(o.ideaId, 'decline'));
                        if (r) setAnswered((a) => ({ ...a, [o.ideaId]: 'decline' }));
                      }}
                    >
                      {copy.explore.no}
                    </button>
                    <a className="d-see-all" href={o.url} target="_blank" rel="noopener noreferrer">
                      {copy.explore.open}
                    </a>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </>
      );
    return (
      <>
        <p className="d-sr">{copy.home.todayEyebrow}</p>
        <h2>{copy.explore.ask}</h2>
        <p>{copy.explore.line}</p>
        <form
          className="d-one-other d-one-other--stack"
          onSubmit={(e) => {
            e.preventDefault();
            if (want.trim()) void act(() => engineApi.explore(want.trim(), region.trim() || undefined));
          }}
        >
          <input
            aria-label={copy.explore.label}
            placeholder={copy.explore.placeholder}
            maxLength={600}
            value={want}
            onChange={(e) => setWant(e.target.value)}
          />
          <input
            aria-label={copy.explore.region}
            placeholder={copy.explore.regionPlaceholder}
            maxLength={80}
            value={region}
            onChange={(e) => setRegion(e.target.value)}
          />
          <button type="submit" className="d-one-thing-btn" disabled={busy || !want.trim()}>
            {copy.explore.go}
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <p className="d-sr">{copy.home.todayEyebrow}</p>
      <h2>{copy.home.nothingTitle}</h2>
      <p>{copy.home.nothingLine}</p>
    </>
  );
}
