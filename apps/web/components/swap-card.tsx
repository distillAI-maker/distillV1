'use client';

import { useState } from 'react';
import { copy } from '../lib/copy';
import { engineApi, type EngineResult } from '../lib/engine/client';
import { useEngine } from '../lib/engine/context';

type Offer = NonNullable<EngineResult['swap']>;

/**
 * The catalog's swap for something they let go of (chamomile tea for apigenin), offered once. Yes
 * adds it to their Ritual; no means it's never offered again. `look` matches where it sits: today's
 * card or the companion thread.
 */
export function SwapCard({ offer, look }: { offer: Offer; look: 'today' | 'chat' }) {
  const { act, busy } = useEngine();
  const [said, setSaid] = useState<'add' | 'decline' | null>(null);
  const answer = async (a: 'add' | 'decline') => {
    if (await act(() => engineApi.swapAnswer(offer.itemKey, a))) setSaid(a);
  };
  const when = copy.swap.when(offer.perWeek, offer.slot);
  if (look === 'chat')
    return (
      <li className="d-prompt-card d-prompt-card--question" aria-live="polite">
        <p className="d-prompt-card__q">{copy.swap.ask}</p>
        <p className="d-prompt-card__body">
          {offer.title} · {when}
        </p>
        {said ? (
          <p className="d-prompt-card__body">{said === 'add' ? copy.swap.added : copy.swap.declined}</p>
        ) : (
          <div className="d-prompt-card__actions">
            <button type="button" className="d-prompt-btn d-prompt-btn--confirm" disabled={busy} onClick={() => void answer('add')}>
              {copy.swap.add}
            </button>
            <button type="button" className="d-prompt-btn" disabled={busy} onClick={() => void answer('decline')}>
              {copy.swap.no}
            </button>
          </div>
        )}
      </li>
    );
  return (
    <div className="d-one-swap" aria-live="polite">
      <p className="d-one-swap__ask">{copy.swap.ask}</p>
      <p className="d-one-swap__part">
        <strong>{offer.title}</strong> · {when}
      </p>
      {said ? (
        <p className="d-one-thing-done">{said === 'add' ? copy.swap.added : copy.swap.declined}</p>
      ) : (
        <div className="d-one-thing-actions">
          <button type="button" className="d-one-thing-btn d-one-thing-btn--go" disabled={busy} onClick={() => void answer('add')}>
            {copy.swap.add}
          </button>
          <button type="button" className="d-one-thing-btn" disabled={busy} onClick={() => void answer('decline')}>
            {copy.swap.no}
          </button>
        </div>
      )}
    </div>
  );
}
