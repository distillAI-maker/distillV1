'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Skeleton } from '../../../../../components/ui';
import { distillNotes } from '../../../../../lib/ai/distill-action';
import { shortName } from '../../../../../lib/catalog/short-names';
import { copy } from '../../../../../lib/copy';
import { useRouted } from '../../../../../lib/data/use-routed';
import { useProgress } from '../../../../../lib/progress/context';
import { newItemId } from '../../../../../lib/progress/types';
import s from '../../home.module.css';

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * One ritual: what it means to them (their notes, distilled), the notes themselves, and their say
 * over it. They are the co-creator: "This is mine" settles it as theirs and we stop raising it.
 */
export function RitualView({ id }: { id: string }) {
  const { ready, progress, update } = useProgress();
  const { routed } = useRouted();
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  if (!ready || !routed)
    return (
      <section className={s.page} aria-busy="true">
        <Skeleton kind="title" count={2} />
      </section>
    );

  const item = progress.items.find((i) => i.id === id);
  const routedItem = routed.items.find((r) => r.stackItemId === id);
  if (!item || !routedItem)
    return (
      <section className={s.page}>
        <p>{copy.ritual.missing}</p>
        <Link className={s.link} href="/home">
          {copy.ritual.back}
        </Link>
      </section>
    );

  const kind =
    (item.label && item.itemKey ? shortName(item.itemKey, '') : '') ||
    copy.stack.categories[routedItem.category as keyof typeof copy.stack.categories];
  const isMine = item.status === 'kept' || progress.dayOne.yours.includes(id);
  const patchItem = (change: Partial<typeof item>) =>
    update((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...change } : i)) }));

  async function save() {
    const text = draft.trim().slice(0, 4000);
    if (!text || !item || !routedItem) return;
    const note = { id: newItemId(), text, at: new Date().toISOString() };
    const notes = [...item.notes, note];
    patchItem({ notes });
    setDraft('');
    setBusy(true);
    const result = await distillNotes({
      ritual: routedItem.name,
      kind,
      notes: notes.map((n) => n.text),
    });
    setBusy(false);
    if (result.status === 'ok') patchItem({ notes, essence: result.essence });
  }

  return (
    <div className={s.page}>
      <Link className={s.link} href="/home">
        ← {copy.ritual.back}
      </Link>
      <h1 className={`${s.title} ${s.ritualTitle}`}>{routedItem.name}</h1>
      <p className={s.caption}>
        {[kind, copy.dayOne.perMonth(money(routedItem.monthlyCost))].join(' · ')}
      </p>

      {item.essence ? (
        <section className={s.essence} aria-label={copy.ritual.meansEyebrow}>
          <p className={s.eyebrow}>{copy.ritual.meansEyebrow}</p>
          <p className={s.essenceText}>{item.essence}</p>
        </section>
      ) : null}

      <section className={s.composer} aria-label={copy.ritual.notesEyebrow}>
        <label className={s.eyebrow} htmlFor="ritual-note">
          {copy.ritual.notesEyebrow}
        </label>
        <textarea
          id="ritual-note"
          value={draft}
          maxLength={4000}
          rows={4}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={copy.ritual.placeholder}
        />
        <div className={s.actions}>
          <button
            type="button"
            className={s.primary}
            onClick={() => void save()}
            disabled={!draft.trim() || busy}
          >
            {busy ? copy.ritual.distilling : copy.ritual.save}
          </button>
        </div>
        {item.notes.length ? (
          <ul className={s.notes}>
            {[...item.notes].reverse().map((n) => (
              <li key={n.id}>
                <p>{n.text}</p>
                <span>
                  {new Date(n.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  <button
                    type="button"
                    className={s.link}
                    aria-label={copy.ritual.deleteNote}
                    onClick={() => patchItem({ notes: item.notes.filter((x) => x.id !== n.id) })}
                  >
                    ×
                  </button>
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className={s.today} aria-label={copy.ritual.mine}>
        {item.status === 'cut' ? (
          <>
            <h2>{copy.ritual.letGone}</h2>
            <button
              type="button"
              className={s.link}
              onClick={() => patchItem({ status: 'listed' })}
            >
              {copy.ritual.undo}
            </button>
          </>
        ) : isMine ? (
          <>
            <h2>{copy.ritual.isMine}</h2>
            <button
              type="button"
              className={s.link}
              onClick={() =>
                update((p) => ({
                  ...p,
                  dayOne: { ...p.dayOne, yours: p.dayOne.yours.filter((y) => y !== id) },
                  items: p.items.map((i) => (i.id === id ? { ...i, status: 'listed' } : i)),
                }))
              }
            >
              {copy.ritual.undo}
            </button>
          </>
        ) : (
          <div className={s.actions}>
            <button
              type="button"
              className={s.primary}
              onClick={() =>
                update((p) => ({
                  ...p,
                  dayOne: { ...p.dayOne, yours: [...new Set([...p.dayOne.yours, id])] },
                  items: p.items.map((i) => (i.id === id ? { ...i, status: 'kept' } : i)),
                }))
              }
            >
              {copy.ritual.mine}
            </button>
            <button
              type="button"
              className={s.secondary}
              onClick={() => patchItem({ status: 'cut' })}
            >
              {copy.ritual.letGo}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
