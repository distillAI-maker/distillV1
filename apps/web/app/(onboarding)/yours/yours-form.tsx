'use client';

import { useId, useState } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Chip, Skeleton } from '../../../components/ui';
import { displayName } from '../../../lib/catalog/short-names';
import { copy } from '../../../lib/copy';
import { addOwnThing, lifeChips, lifePicks, toggleLife, toggleYours } from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';

/**
 * Step 5: what makes you, you. Things from their list they'd never give up become theirs (locked in
 * their Ritual); things from their life, and their own additions, are kept in their words.
 */
export function YoursForm({ names }: { names: Record<string, string> }) {
  const go = useGo();
  const { ready, progress, update } = useProgress();
  const [draft, setDraft] = useState('');
  const addId = useId();

  if (!ready)
    return (
      <section className="stack" aria-busy="true">
        <h1>{copy.makesYou.title}</h1>
        <Skeleton kind="option" count={3} />
      </section>
    );

  const now = () => new Date().toISOString();
  const items = progress.items.filter((i) => i.status !== 'cut' && !i.dataSource);
  const yours = new Set(progress.dayOne.yours);
  const picks = lifePicks(progress);
  const picked = new Set(picks.map((p) => p.toLowerCase()));
  // Their own additions sit after the life chips, picked.
  const own = picks.filter((p) => !lifeChips.some((c) => c.toLowerCase() === p.toLowerCase()));

  function add() {
    const text = draft.trim();
    if (!text) return;
    update((p) => addOwnThing(p, text, now()));
    setDraft('');
  }

  return (
    <section className="stack screen-yours">
      <h1>{copy.makesYou.title}</h1>
      <p className="lede">{copy.makesYou.line}</p>

      {items.length ? (
        <div className="stack-tight yours-group">
          <h2 className="goals-label">{copy.makesYou.fromList}</h2>
          <div className="chips" role="group" aria-label={copy.makesYou.fromList}>
            {items.map((i) => (
              <Chip
                key={i.id}
                selected={yours.has(i.id)}
                onClick={() => update((p) => toggleYours(p, i.id))}
              >
                {displayName(i, i.itemKey ? names[i.itemKey] : undefined)}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}

      <div className="stack-tight yours-group">
        <h2 className="goals-label">{copy.makesYou.fromLife}</h2>
        <div className="chips" role="group" aria-label={copy.makesYou.fromLife}>
          {[...lifeChips, ...own].map((c) => (
            <Chip
              key={c}
              selected={picked.has(c.toLowerCase())}
              onClick={() => update((p) => toggleLife(p, c, now()))}
            >
              {c}
            </Chip>
          ))}
        </div>
        <form
          className="add-own"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <label className="sr-only" htmlFor={addId}>
            {copy.makesYou.addLabel}
          </label>
          <input
            id={addId}
            value={draft}
            maxLength={80}
            enterKeyHint="done"
            placeholder={copy.makesYou.addPlaceholder}
            onChange={(e) => setDraft(e.target.value)}
          />
          <button type="submit" className="add-own-btn" disabled={!draft.trim()}>
            {copy.makesYou.add}
          </button>
        </form>
      </div>

      <div className="actions">
        <Button
          onClick={() => {
            // Whatever is typed but not added still counts.
            if (draft.trim()) update((p) => addOwnThing(p, draft.trim(), now()));
            go('reveal');
          }}
        >
          {copy.makesYou.next}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}
