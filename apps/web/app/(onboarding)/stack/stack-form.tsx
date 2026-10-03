'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useMemo, useState } from 'react';
import { Icon } from '../../../components/icon';
import { Button, Chip, Field, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { demoGoals, demoStack } from '../../../lib/data/demo/stack';
import { useProgress } from '../../../lib/progress/context';
import { newItemId, originSchema } from '../../../lib/progress/types';
import type { Origin, StackItem } from '../../../lib/progress/types';
import { matchText } from '../../../lib/search/match';
import type { IndexEntry } from '../../../lib/search/match';
import { Typeahead } from './typeahead';

const categoryOrder = [
  'supplement',
  'food/drink',
  'timing',
  'habit',
  'device',
  'service',
  'environment',
  'skincare',
  'custom',
] as const;
type Category = (typeof categoryOrder)[number];

const protectedOrigins: Origin[] = ['doctor', 'blood test'];

function money(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

export function StackForm({ index }: { index: IndexEntry[] }) {
  const router = useRouter();
  const { ready, progress, update } = useProgress();
  const byKey = useMemo(() => new Map(index.map((e) => [e.key, e])), [index]);
  const [custom, setCustom] = useState<{ open: boolean; name: string; cost: string }>({
    open: false,
    name: '',
    cost: '',
  });
  const [needOne, setNeedOne] = useState(false);
  const [scratchOpen, setScratchOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const scratchId = useId();

  // The demo person arrives with the Worked Example already listed. Once only.
  useEffect(() => {
    if (ready && progress.dataSource === 'demo' && !progress.prefilledFrom && progress.items.length === 0)
      update({ items: demoStack(), goals: demoGoals, prefilledFrom: 'demo' });
  }, [ready, progress.dataSource, progress.prefilledFrom, progress.items.length, update]);

  const items = progress.items;
  const listed = useMemo(
    () => new Set(items.map((i) => i.itemKey).filter((k): k is string => Boolean(k))),
    [items],
  );

  function addCatalog(entry: IndexEntry) {
    if (listed.has(entry.key)) return;
    setNeedOne(false);
    update((p) => ({
      ...p,
      items: [
        ...p.items,
        {
          id: newItemId(),
          itemKey: entry.key,
          monthlyCost: entry.cost,
          answers: {},
          chips: {},
          unknown: [],
          status: 'listed',
          position: p.items.length,
        },
      ],
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
    update((p) => ({ ...p, items: p.items.filter((i) => i.id !== id) }));
  }
  function next() {
    if (!items.length) {
      setNeedOne(true);
      return;
    }
    update({ step: 'goals' });
    router.push('/goals');
  }

  const total = items.reduce((t, i) => t + (Number.isFinite(i.monthlyCost) ? i.monthlyCost : 0), 0);
  const nameOf = (i: StackItem) => (i.itemKey ? (byKey.get(i.itemKey)?.name ?? i.itemKey) : (i.customName ?? ''));
  const categoryOf = (i: StackItem): Category =>
    i.itemKey ? ((byKey.get(i.itemKey)?.category as Category) ?? 'custom') : 'custom';
  const groups = categoryOrder
    .map((cat) => ({ cat, rows: items.filter((i) => categoryOf(i) === cat) }))
    .filter((g) => g.rows.length > 0);
  const matches = scratchOpen ? matchText(notes, index).filter((e) => !listed.has(e.key)) : [];

  if (!ready) {
    return (
      <section className="stack" aria-busy="true">
        <h1>{copy.stack.title}</h1>
        <p className="lede">{copy.stack.line}</p>
        <Skeleton kind="title" />
        <Skeleton kind="option" count={3} />
      </section>
    );
  }

  return (
    <section className="stack">
      <h1>{copy.stack.title}</h1>
      <p className="lede">{copy.stack.line}</p>
      {progress.prefilledFrom === 'demo' ? <p className="notice">{copy.stack.demoLine}</p> : null}

      <Typeahead
        index={index}
        listed={listed}
        onPick={addCatalog}
        onCustom={(name) => setCustom({ open: true, name, cost: '' })}
      />

      <div className="scratch">
        <button
          type="button"
          className="disclose"
          aria-expanded={scratchOpen}
          aria-controls={scratchId}
          onClick={() => setScratchOpen((o) => !o)}
        >
          {copy.stack.scratchToggle}
          <Icon name="down" size={16} />
        </button>
        {scratchOpen ? (
          <div className="field" id={scratchId}>
            <label htmlFor={`${scratchId}-t`}>{copy.stack.scratchLabel}</label>
            <textarea
              id={`${scratchId}-t`}
              placeholder={copy.stack.scratchPlaceholder}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              aria-describedby={`${scratchId}-h`}
            />
            <p className="hint" id={`${scratchId}-h`}>
              {copy.stack.scratchHint}
            </p>
            {matches.length ? (
              <div className="chips" aria-live="polite">
                {matches.map((m) => (
                  <Chip key={m.key} selected={false} onClick={() => addCatalog(m)}>
                    {copy.stack.addMatch(m.name)}
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

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
            <Button variant="link" size="sm" onClick={() => setCustom({ open: false, name: '', cost: '' })}>
              {copy.common.cancel}
            </Button>
          </div>
        </form>
      ) : (
        <div>
          <Button variant="ghost" size="sm" onClick={() => setCustom({ open: true, name: '', cost: '' })}>
            <Icon name="plus" size={16} />
            {copy.stack.addCustom}
          </Button>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.cat} aria-labelledby={`cat-${g.cat.replace('/', '-')}`}>
          <div className="cat-head">
            <h2 className="label" id={`cat-${g.cat.replace('/', '-')}`} style={{ fontSize: 12 }}>
              {copy.stack.categories[g.cat]}
            </h2>
          </div>
          <ul className="item-list" style={{ marginTop: 10 }}>
            {g.rows.map((row) => {
              const name = nameOf(row);
              const isProtected = row.origin ? protectedOrigins.includes(row.origin) : false;
              return (
                <li key={row.id} className="glass item-row">
                  <div className="head">
                    <div>
                      <div className="name">{name}</div>
                      {isProtected || row.dataSource ? (
                        <div className="tags">
                          {isProtected ? (
                            <span className="tag">
                              <Icon name="shield" />
                              {copy.stack.protectedTag}
                            </span>
                          ) : null}
                          {row.dataSource ? (
                            <span className="tag">
                              <Icon name="watch" />
                              {copy.stack.dataSourceTag}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      className="iconbtn"
                      aria-label={copy.stack.remove(name)}
                      onClick={() => remove(row.id)}
                    >
                      <Icon name="minusc" />
                    </button>
                  </div>
                  <div className="cost">
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
                    <span>{copy.stack.costLabel}</span>
                  </div>
                  {row.dataSource ? null : (
                    <div className="origin" role="radiogroup" aria-label={copy.stack.originFor(name)}>
                      <span className="field-label">{copy.stack.originLabel}</span>
                      <div className="chips">
                        {originSchema.options.map((o) => (
                          <Chip
                            key={o}
                            radio
                            selected={row.origin === o}
                            onClick={() => patch(row.id, { origin: o })}
                          >
                            {copy.stack.origins[o]}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}

      <div className="total" aria-live="polite">
        <span className="mono">
          {items.length === 1 ? copy.stack.totalOne(money(total)) : copy.stack.total(items.length, money(total))}
        </span>
      </div>
      {needOne ? (
        <p className="notice" role="alert">
          {copy.stack.needOne}
        </p>
      ) : null}
      <div className="actions">
        <Button onClick={next}>{copy.stack.done}</Button>
      </div>
    </section>
  );
}
