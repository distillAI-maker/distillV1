'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Field, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { demoGoals, demoStack } from '../../../lib/data/demo/stack';
import { useProgress } from '../../../lib/progress/context';
import { newItemId } from '../../../lib/progress/types';
import type { Origin, StackItem } from '../../../lib/progress/types';
import { matchText } from '../../../lib/search/match';
import type { IndexEntry } from '../../../lib/search/match';
import { Typeahead } from './typeahead';

const categoryOrder = [
  'service',
  'supplement',
  'food/drink',
  'skincare',
  'device',
  'habit',
  'timing',
  'environment',
  'custom',
] as const;
type Category = (typeof categoryOrder)[number];

const protectedOrigins: Origin[] = ['doctor', 'blood test'];

function catalogRow(entry: IndexEntry, position: number): StackItem {
  return {
    id: newItemId(),
    itemKey: entry.key,
    monthlyCost: entry.cost,
    answers: {},
    chips: {},
    unknown: [],
    status: 'listed',
    position,
  };
}

/**
 * Your stack, in the Figma build's two stages. First the person talks it through and we match what
 * we recognise in the routing table; then they edit the list: costs, and anything we missed. Where
 * each thing came from is asked later, in the app, not here.
 */
export function StackForm({ index }: { index: IndexEntry[] }) {
  const go = useGo();
  const { ready, progress, update } = useProgress();
  const byKey = useMemo(() => new Map(index.map((e) => [e.key, e])), [index]);
  const [stage, setStage] = useState<'listen' | 'edit' | null>(null);
  const [notes, setNotes] = useState('');
  const [custom, setCustom] = useState<{ open: boolean; name: string; cost: string }>({
    open: false,
    name: '',
    cost: '',
  });
  const [needOne, setNeedOne] = useState(false);
  const notesId = useId();

  // Someone coming back to a list they started lands on the list, not the blank page.
  useEffect(() => {
    if (ready && stage === null) setStage(progress.items.length ? 'edit' : 'listen');
  }, [ready, stage, progress.items.length]);

  // Moving from talking to the list starts the list at its title.
  useEffect(() => {
    if (stage === 'edit') window.scrollTo({ top: 0, behavior: 'instant' });
  }, [stage]);

  const items = progress.items;
  const listed = useMemo(
    () => new Set(items.map((i) => i.itemKey).filter((k): k is string => Boolean(k))),
    [items],
  );
  const heard = useMemo(
    () => matchText(notes, index).filter((e) => !listed.has(e.key)),
    [notes, index, listed],
  );

  function addCatalog(entries: IndexEntry[]) {
    const fresh = entries.filter((e) => !listed.has(e.key));
    if (!fresh.length) return;
    setNeedOne(false);
    update((p) => ({
      ...p,
      items: [...p.items, ...fresh.map((e, i) => catalogRow(e, p.items.length + i))],
    }));
  }
  function addCustom(name: string, cost: number) {
    const trimmed = name.trim().slice(0, 120);
    if (!trimmed) return;
    setNeedOne(false);
    update((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          id: newItemId(),
          itemKey: null,
          customName: trimmed,
          monthlyCost: Number.isFinite(cost) && cost >= 0 ? cost : 0,
          answers: {},
          chips: {},
          unknown: [],
          status: 'listed',
          position: p.items.length,
        },
      ],
    }));
    setCustom({ open: false, name: '', cost: '' });
  }
  function patch(id: string, change: Partial<StackItem>) {
    update((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, ...change } : i)) }));
  }
  function remove(id: string) {
    update((p) => ({
      ...p,
      items: p.items.filter((i) => i.id !== id),
      dayOne: { ...p.dayOne, yours: p.dayOne.yours.filter((y) => y !== id) },
    }));
  }
  function useExample() {
    update({ items: demoStack(), goals: demoGoals, prefilledFrom: 'demo' });
    setStage('edit');
  }
  function next() {
    if (!items.length) {
      setNeedOne(true);
      return;
    }
    go('life');
  }

  if (!ready || stage === null) {
    return (
      <section className="stack" aria-busy="true">
        <h1>{copy.stack.listen.title}</h1>
        <Skeleton kind="title" />
        <Skeleton kind="option" count={2} />
      </section>
    );
  }

  if (stage === 'listen') {
    return (
      <section className="stack screen-listen">
        <h1>{copy.stack.listen.title}</h1>
        <p className="lede">{copy.stack.listen.line}</p>
        <div className="writing">
          <label className="sr-only" htmlFor={notesId}>
            {copy.stack.listen.label}
          </label>
          <textarea
            id={notesId}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={copy.stack.listen.placeholder}
            rows={5}
          />
          <div className="writing-foot" aria-live="polite">
            <span>{notes.trim() ? copy.stack.listen.heard(heard.length) : copy.life.empty}</span>
          </div>
        </div>
        {heard.length ? (
          <ul className="heard-list" aria-label={copy.stack.listen.heard(heard.length)}>
            {heard.slice(0, 12).map((h) => (
              <li key={h.key}>{h.name}</li>
            ))}
          </ul>
        ) : null}
        <div className="actions">
          <Button
            onClick={() => {
              addCatalog(heard);
              setStage('edit');
            }}
          >
            {copy.stack.listen.find}
            <Icon name="arrow" size={18} />
          </Button>
          {items.length === 0 ? (
            <Button variant="link" onClick={useExample}>
              {copy.stack.listen.example}
            </Button>
          ) : null}
        </div>
      </section>
    );
  }

  const nameOf = (i: StackItem) =>
    i.itemKey ? (byKey.get(i.itemKey)?.name ?? i.itemKey) : (i.customName ?? '');
  const categoryOf = (i: StackItem): Category =>
    i.itemKey ? ((byKey.get(i.itemKey)?.category as Category) ?? 'custom') : 'custom';
  const groups = categoryOrder
    .map((cat) => ({ cat, rows: items.filter((i) => categoryOf(i) === cat) }))
    .filter((g) => g.rows.length > 0);

  return (
    <section className="stack screen-edit">
      <h1>{copy.stack.edit.title}</h1>
      <p className="edit-note">{items.length ? copy.stack.edit.note : copy.stack.edit.emptyNote}</p>
      {progress.prefilledFrom === 'demo' ? <p className="notice">{copy.stack.demoLine}</p> : null}

      <Typeahead
        index={index}
        listed={listed}
        onPick={(e) => addCatalog([e])}
        onCustom={(name) => setCustom({ open: true, name, cost: '' })}
      />

      {groups.map((g) => (
        <section key={g.cat} className="cat" aria-labelledby={`cat-${g.cat.replace('/', '-')}`}>
          <h2 className="cat-label" id={`cat-${g.cat.replace('/', '-')}`}>
            {copy.stack.categories[g.cat]}
          </h2>
          <ul className="rows">
            {g.rows.map((row) => {
              const name = nameOf(row);
              const isProtected = row.origin ? protectedOrigins.includes(row.origin) : false;
              return (
                <li key={row.id} className="row-wrap">
                  <div className="row">
                    <span className="row-name">
                      {name}
                      {isProtected ? (
                        <span className="tag">
                          <Icon name="shield" size={14} />
                          {copy.stack.protectedTag}
                        </span>
                      ) : null}
                      {row.dataSource ? (
                        <span className="tag">
                          <Icon name="watch" size={14} />
                          {copy.stack.dataSourceTag}
                        </span>
                      ) : null}
                    </span>
                    <span className="row-cost">
                      <span aria-hidden="true">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={1}
                        aria-label={copy.stack.costFor(name)}
                        value={Number.isFinite(row.monthlyCost) ? row.monthlyCost : ''}
                        onChange={(e) => {
                          const n = e.target.value === '' ? 0 : Number(e.target.value);
                          patch(row.id, { monthlyCost: Number.isFinite(n) && n >= 0 ? n : 0 });
                        }}
                      />
                      <span className="unit">{copy.stack.costLabel}</span>
                    </span>
                    <button
                      type="button"
                      className="row-x"
                      aria-label={copy.stack.remove(name)}
                      onClick={() => remove(row.id)}
                    >
                      <span aria-hidden="true">×</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      {custom.open ? (
        <form
          className="glass custom-form"
          onSubmit={(e) => {
            e.preventDefault();
            addCustom(custom.name, Number(custom.cost || 0));
          }}
        >
          <Field
            label={copy.stack.customName}
            value={custom.name}
            onChange={(e) => setCustom({ ...custom, name: e.target.value })}
            maxLength={120}
            required
            autoFocus
          />
          <Field
            label={copy.stack.customCost}
            type="number"
            inputMode="decimal"
            min={0}
            step={1}
            unit="$ a month"
            value={custom.cost}
            onChange={(e) => setCustom({ ...custom, cost: e.target.value })}
            hint={copy.stack.customNote}
          />
          <div className="actions-row">
            <Button type="submit" size="sm">
              {copy.stack.addIt}
            </Button>
            <Button
              variant="link"
              size="sm"
              onClick={() => setCustom({ open: false, name: '', cost: '' })}
            >
              {copy.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          className="row add-row"
          onClick={() => setCustom({ open: true, name: '', cost: '' })}
        >
          <span className="row-name">{copy.stack.addCustom}</span>
          <span aria-hidden="true">+</span>
        </button>
      )}

      {needOne ? (
        <p className="notice" role="alert">
          {copy.stack.needOne}
        </p>
      ) : null}
      <div className="actions">
        <Button onClick={next}>
          {copy.stack.done}
          <Icon name="arrow" size={18} />
        </Button>
        {items.length === 0 ? (
          <Button variant="link" onClick={useExample}>
            {copy.stack.listen.example}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
