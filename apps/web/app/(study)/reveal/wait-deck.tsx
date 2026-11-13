'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Arrow, Mark } from '../../../components/ds/ui';
import { copy } from '../../../lib/copy';

const w = copy.reveal.wait;
const money = (n: number) => Math.round(n).toLocaleString('en-US');
/** How long each card shows before the deck moves on by itself, until they touch it. */
const CARD_MS = 4600;
/** How long each line over the deck shows. */
const LINE_MS = 3200;

export interface WaitFacts {
  /** What they said they'd never give up. */
  readonly loves: readonly string[];
  readonly count: number;
  readonly monthly: number;
}

function Card({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <article className="wd-card">
      <div className="wd-art" aria-hidden="true">
        {children}
      </div>
      <h2>{title}</h2>
      <p>{body}</p>
    </article>
  );
}

/**
 * The wait for their first Ritual, as a small deck of cards about Distill to swipe through. It moves on
 * by itself until they touch it. The line at the top says what's happening; once the Ritual is ready,
 * someone reading a card gets a button rather than being moved on mid-sentence.
 */
export function WaitDeck({
  lines,
  facts,
  ready,
  still,
  onTouch,
  onSee,
}: {
  lines: readonly string[];
  facts: WaitFacts;
  /** Their Ritual is ready (and they've been reading, so it waits for them). */
  ready: boolean;
  still: boolean;
  onTouch: () => void;
  onSee: () => void;
}) {
  const all = [copy.reveal.shaping, ...lines, copy.reveal.finishing];
  const [at, setAt] = useState(0);
  const [card, setCard] = useState(0);
  const deck = useRef<HTMLDivElement>(null);
  const touched = useRef(false);

  const cards = [
    <Card key="talk" title={w.talk.title} body={w.talk.body}>
      <div className="wd-chat">
        <span className="wd-you">{w.talk.you}</span>
        <span className="wd-reply">
          <Mark size="xs" />
          {w.talk.reply}
        </span>
      </div>
    </Card>,
    <Card key="yours" title={w.yours.title} body={facts.loves.length ? w.yours.body : w.yours.none}>
      <div className="wd-loves">
        {(facts.loves.length ? facts.loves.slice(0, 4) : [w.yours.example]).map((l) => (
          <span key={l} className={facts.loves.length ? '' : 'is-example'}>
            <svg viewBox="0 0 12 14" width="10" height="12">
              <path d="M3 6V4a3 3 0 0 1 6 0v2M2 6h8v7H2z" fill="none" stroke="currentColor" strokeWidth="1.4" />
            </svg>
            {l}
          </span>
        ))}
      </div>
    </Card>,
    <Card key="money" title={w.money.title} body={w.money.body}>
      <div className="wd-money">
        <span>{w.money.things(facts.count)}</span>
        {facts.monthly > 0 ? (
          <strong>
            ${money(facts.monthly)}
            <small>{w.money.aMonth}</small>
          </strong>
        ) : null}
      </div>
    </Card>,
    <Card key="near" title={w.near.title} body={w.near.body}>
      <div className="wd-event">
        <small>{w.near.when}</small>
        <strong>{w.near.what}</strong>
        <span>{w.near.add}</span>
      </div>
    </Card>,
    <Card key="whole" title={w.whole.title} body={w.whole.body}>
      <div className="wd-whole">
        {w.whole.parts.map((p, i) => (
          <span key={p} style={{ animationDelay: `${i * 140}ms` }}>
            {p}
          </span>
        ))}
      </div>
    </Card>,
  ];

  useEffect(() => {
    if (still) return;
    const t = window.setInterval(() => setAt((i) => i + 1), LINE_MS);
    return () => window.clearInterval(t);
  }, [still]);

  const show = (i: number) => {
    const el = deck.current;
    const child = el?.children[i] as HTMLElement | undefined;
    if (!el || !child) return;
    el.scrollTo?.({ left: child.offsetLeft - (el.clientWidth - child.clientWidth) / 2, behavior: still ? 'auto' : 'smooth' });
  };

  // The deck moves on by itself, stopping at the last card, until they touch it.
  useEffect(() => {
    if (still) return;
    const t = window.setInterval(() => {
      if (touched.current) return;
      setCard((c) => {
        const next = Math.min(c + 1, cards.length - 1);
        show(next);
        return next;
      });
    }, CARD_MS);
    return () => window.clearInterval(t);
    // `show` reads the deck from a ref; the number of cards is fixed.
  }, [still]);

  const touch = () => {
    if (touched.current) return;
    touched.current = true;
    onTouch();
  };
  const onScroll = () => {
    const el = deck.current;
    if (!el) return;
    const middle = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let gap = Infinity;
    Array.from(el.children).forEach((c, i) => {
      const h = c as HTMLElement;
      const d = Math.abs(h.offsetLeft + h.clientWidth / 2 - middle);
      if (d < gap) {
        gap = d;
        best = i;
      }
    });
    setCard(best);
  };

  const line = all[Math.min(at, all.length - 1)];
  return (
    <main className={`wd${ready ? ' is-ready' : ''}`} aria-busy={!ready}>
      <div className="wd-status" aria-live="polite">
        <Mark size="sm" />
        <span key={ready ? 'ready' : line}>{ready ? w.ready : line}</span>
      </div>
      <div
        ref={deck}
        className="wd-deck"
        role="region"
        aria-roledescription="carousel"
        aria-label={w.label}
        onScroll={onScroll}
        onPointerDown={touch}
        onTouchStart={touch}
        onWheel={touch}
      >
        {cards}
      </div>
      <div className="wd-dots" role="tablist" aria-label={w.label}>
        {cards.map((c, i) => (
          <button
            key={c.key}
            type="button"
            role="tab"
            aria-selected={i === card}
            aria-label={String(i + 1)}
            onClick={() => {
              touch();
              setCard(i);
              show(i);
            }}
          />
        ))}
      </div>
      <div className="wd-foot">
        {ready ? (
          <button type="button" className="ds-primary" onClick={onSee}>
            {w.see}
            <Arrow />
          </button>
        ) : (
          <i className="wd-bar" />
        )}
      </div>
    </main>
  );
}
