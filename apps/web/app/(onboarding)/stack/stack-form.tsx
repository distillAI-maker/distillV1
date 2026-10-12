'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Chip, Field, Skeleton } from '../../../components/ui';
import { commonGroups, commonRow, type CommonItem } from '../../../lib/catalog/common';
import { displayName, shortName } from '../../../lib/catalog/short-names';
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

/**
 * The brand as the person wrote it ("Equinox", "AG1"), when what they typed matched one of the
 * item's names with a capital or a digit; plain words ("magnesium") use the short label instead.
 */
function typedLabel(text: string, entry: IndexEntry): string | undefined {
  for (const alias of entry.aliases) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = text.match(new RegExp(`\\b${escaped}\\b`, 'i'))?.[0];
    if (found && found.length <= 40 && /^[A-Z0-9]/.test(found)) return found;
  }
  return undefined;
}

function catalogRow(entry: IndexEntry, position: number, label?: string): StackItem {
  return {
    id: newItemId(),
    itemKey: entry.key,
    ...(label ? { label } : {}),
    monthlyCost: entry.cost,
    answers: {},
    chips: {},
    unknown: [],
    status: 'listed',
    notes: [],
    position,
  };
}

/**
 * Your stack. First they tap what they do from the things people most often have (recognising is
 * easier than remembering), or talk it through and we match what we recognise; then they edit the
 * list: costs, and anything we missed. Where each thing came from is asked later, in the app.
 */
export function StackForm({ index }: { index: IndexEntry[] }) {
  const go = useGo();
  const { ready, progress, update } = useProgress();
  const byKey = useMemo(() => new Map(index.map((e) => [e.key, e])), [index]);
  const [stage, setStage] = useState<'tap' | 'listen' | 'edit' | null>(null);
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
    if (ready && stage === null) setStage(progress.items.length ? 'edit' : 'tap');
  }, [ready, stage, progress.items.length]);

  // Each stage starts at its title.
  useEffect(() => {
    if (stage) window.scrollTo({ top: 0, behavior: 'instant' });
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

  function addCatalog(entries: IndexEntry[], said = '') {
    const fresh = entries.filter((e) => !listed.has(e.key));
    if (!fresh.length) return;
    setNeedOne(false);
    update((p) => ({
      ...p,
      items: [
        ...p.items,
        ...fresh.map((e, i) => catalogRow(e, p.items.length + i, typedLabel(said, e))),
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
          notes: [],
          position: p.items.length,
        },
      ],
    }));
    setCustom({ open: false, name: '', cost: '' });
  }
  /** A chip: on adds it at the table's cost, off takes it out again. */
  function toggleCommon(item: CommonItem) {
    setNeedOne(false);
    update((p) => {
      const there = p.items.find((i) => i.itemKey === item.key);
      if (there)
        return {
          ...p,
          items: p.items.filter((i) => i.id !== there.id),
          dayOne: { ...p.dayOne, yours: p.dayOne.yours.filter((y) => y !== there.id) },
        };
      return { ...p, items: [...p.items, commonRow(item, p.items.length)] };
    });
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

  if (stage === 'tap') {
    return (
      <section className="stack screen-tap">
        <h1>{copy.stack.tap.title}</h1>
        <p className="lede">{copy.stack.tap.line}</p>
        {commonGroups.map((g) => (
          <div key={g.id} className="stack-tight tap-group">
            <h2 className="goals-label">{copy.stack.tap.groups[g.id]}</h2>
            <div className="chips" role="group" aria-label={copy.stack.tap.groups[g.id]}>
              {g.items.map((item) => (
                <Chip
                  key={item.key}
                  selected={listed.has(item.key)}
                  onClick={() => toggleCommon(item)}
                >
                  {item.text}
                </Chip>
              ))}
            </div>
          </div>
        ))}
        <div className="tap-other">
          <Button variant="link" onClick={() => setStage('listen')}>
            {copy.stack.tap.talk}
          </Button>
          {items.length === 0 ? (
            <Button variant="link" onClick={useExample}>
              {copy.stack.listen.example}
            </Button>
          ) : null}
        </div>
        <div className="actions tap-next">
          <Button onClick={() => setStage('edit')}>
            {copy.stack.tap.next}
            <Icon name="arrow" size={18} />
          </Button>
        </div>
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
          {notes.trim() ? (
            <div className="writing-foot" aria-live="polite">
              <span>{copy.stack.listen.heard(heard.length)}</span>
            </div>
          ) : null}
        </div>
        {heard.length ? (
          <ul className="heard-list" aria-label={copy.stack.listen.heard(heard.length)}>
            {heard.slice(0, 12).map((h) => (
              <li key={h.key}>{typedLabel(notes, h) ?? shortName(h.key, h.name)}</li>
            ))}
          </ul>
        ) : null}
        <div className="actions">
          <Button
            onClick={() => {
              addCatalog(heard, notes);
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
    displayName(i, i.itemKey ? byKey.get(i.itemKey)?.name : undefined);
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
        <Button variant="link" onClick={() => setStage('tap')}>
          {copy.stack.tap.back}
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
