'use client';

import { useEffect, useId, useMemo, useState } from 'react';
import { useBackHandler } from '../../../components/back-handler';
import { useGo } from '../../../components/onboarding/go';
import { useStepNumber } from '../../../components/onboarding/step-number';
import { Arrow, Bubble, Disclaimer } from '../../../components/ds/ui';
import { commonGroups, commonRow, type CommonItem } from '../../../lib/catalog/common';
import { displayName, shortName } from '../../../lib/catalog/short-names';
import { copy } from '../../../lib/copy';
import { demoGoals, demoStack } from '../../../lib/data/demo/stack';
import { useProgress } from '../../../lib/progress/context';
import { newItemId } from '../../../lib/progress/types';
import type { Origin, StackItem } from '../../../lib/progress/types';
import { matchText } from '../../../lib/search/match';
import { track } from '../../../lib/track';
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

  // Tapping is step 1; the list ("anything we missed") is step 2, and Back from it returns to the taps.
  useStepNumber(stage === 'edit' ? 2 : 1);
  useBackHandler(
    stage === 'edit' || stage === 'listen'
      ? () => {
          setStage('tap');
          return true;
        }
      : null,
  );

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
    track('stack_done', { count: items.length });
    go('number');
  }

  if (!ready || stage === null) {
    return (
      <div className="ob-content" aria-busy="true">
        <header className="ob-heading">
          <h1>{copy.stack.listen.title}</h1>
        </header>
        <div className="ob-wait">
          <i />
          <i />
        </div>
      </div>
    );
  }

  if (stage === 'tap') {
    return (
      <>
        <div className="ob-content">
          <header className="ob-heading">
            <h1>{copy.stack.tap.title}</h1>
            <p>{copy.stack.tap.line}</p>
          </header>
          <div className="ob-groups">
            {commonGroups.map((g) => (
              <section key={g.id} className="ob-group">
                <h2>{copy.stack.tap.groups[g.id]}</h2>
                <div className="ds-bubbles" role="group" aria-label={copy.stack.tap.groups[g.id]}>
                  {g.items.map((item) => (
                    <Bubble key={item.key} on={listed.has(item.key)} onClick={() => toggleCommon(item)}>
                      {item.text}
                    </Bubble>
                  ))}
                </div>
              </section>
            ))}
          </div>
          <Disclaimer />
        </div>
        <div className="ob-sticky">
          <button type="button" className="ds-primary" onClick={() => setStage('edit')}>
            {copy.stack.tap.next}
            <Arrow />
          </button>
          <div className="ob-other">
            <button type="button" className="ds-link" onClick={() => setStage('listen')}>
              {copy.stack.tap.talk}
            </button>
            {items.length === 0 ? (
              <button type="button" className="ds-link ds-link--quiet" onClick={useExample}>
                {copy.stack.listen.example}
              </button>
            ) : null}
          </div>
        </div>
      </>
    );
  }

  if (stage === 'listen') {
    return (
      <>
        <div className="ob-content">
          <header className="ob-heading">
            <h1>{copy.stack.listen.title}</h1>
            <p>{copy.stack.listen.line}</p>
          </header>
          <label className="sr-only" htmlFor={notesId}>
            {copy.stack.listen.label}
          </label>
          <textarea
            id={notesId}
            className="ob-talk"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={copy.stack.listen.placeholder}
            rows={6}
          />
          {notes.trim() ? (
            <p className="ob-heard-count" aria-live="polite">
              {copy.stack.listen.heard(heard.length)}
            </p>
          ) : null}
          {heard.length ? (
            <ul className="ds-bubbles ob-heard" aria-label={copy.stack.listen.heard(heard.length)}>
              {heard.slice(0, 12).map((h) => (
                <li key={h.key} className="ds-bubble is-chosen">
                  {typedLabel(notes, h) ?? shortName(h.key, h.name)}
                </li>
              ))}
            </ul>
          ) : null}
          <Disclaimer />
        </div>
        <div className="ob-sticky">
          <button
            type="button"
            className="ds-primary"
            onClick={() => {
              addCatalog(heard, notes);
              setStage('edit');
            }}
          >
            {copy.stack.listen.find}
            <Arrow />
          </button>
          <div className="ob-other">
            <button type="button" className="ds-link" onClick={() => setStage('tap')}>
              {copy.stack.tap.back}
            </button>
            {items.length === 0 ? (
              <button type="button" className="ds-link ds-link--quiet" onClick={useExample}>
                {copy.stack.listen.example}
              </button>
            ) : null}
          </div>
        </div>
      </>
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
    <>
      <div className="ob-content">
        <header className="ob-heading">
          <h1>{copy.stack.edit.title}</h1>
          <p>{items.length ? copy.stack.edit.note : copy.stack.edit.emptyNote}</p>
        </header>
        {progress.prefilledFrom === 'demo' ? <p className="ds-notice">{copy.stack.demoLine}</p> : null}

        <Typeahead
          index={index}
          listed={listed}
          onPick={(e) => addCatalog([e])}
          onCustom={(name) => setCustom({ open: true, name, cost: '' })}
        />

        <div className="ob-stack-groups">
          {groups.map((g) => (
            <section key={g.cat} aria-labelledby={`cat-${g.cat.replace('/', '-')}`}>
              <h2 id={`cat-${g.cat.replace('/', '-')}`}>{copy.stack.categories[g.cat]}</h2>
              <ul>
                {g.rows.map((row) => {
                  const name = nameOf(row);
                  const isProtected = row.origin ? protectedOrigins.includes(row.origin) : false;
                  return (
                    <li key={row.id} className="ob-row">
                      <span className="ob-row-name">
                        {name}
                        {isProtected ? <span className="ob-tag">{copy.stack.protectedTag}</span> : null}
                        {row.dataSource ? <span className="ob-tag">{copy.stack.dataSourceTag}</span> : null}
                      </span>
                      <label className="ob-cost">
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
                      </label>
                      <button
                        type="button"
                        className="ob-remove"
                        aria-label={copy.stack.remove(name)}
                        onClick={() => remove(row.id)}
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        {custom.open ? (
          <form
            className="ob-custom"
            onSubmit={(e) => {
              e.preventDefault();
              addCustom(custom.name, Number(custom.cost || 0));
            }}
          >
            <label>
              {copy.stack.customName}
              <input
                value={custom.name}
                onChange={(e) => setCustom({ ...custom, name: e.target.value })}
                maxLength={120}
                required
                autoFocus
              />
            </label>
            <label>
              {copy.stack.customCost}
              <input
                placeholder="$"
                type="number"
                inputMode="decimal"
                min={0}
                step={1}
                value={custom.cost}
                onChange={(e) => setCustom({ ...custom, cost: e.target.value })}
              />
            </label>
            <p>{copy.stack.customNote}</p>
            <div className="ob-custom-actions">
              <button type="submit" className="ds-secondary">
                {copy.stack.addIt}
              </button>
              <button
                type="button"
                className="ds-link ds-link--quiet"
                onClick={() => setCustom({ open: false, name: '', cost: '' })}
              >
                {copy.common.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            className="ob-add-row"
            onClick={() => setCustom({ open: true, name: '', cost: '' })}
          >
            {copy.stack.addCustom}
          </button>
        )}
        <Disclaimer />
      </div>

      <div className="ob-sticky">
        {needOne ? (
          <p className="ds-error" role="alert" style={{ textAlign: 'center' }}>
            {copy.stack.needOne}
          </p>
        ) : null}
        <button type="button" className="ds-primary" onClick={next}>
          {copy.stack.done}
          <Arrow />
        </button>
        <div className="ob-other">
          <button type="button" className="ds-link" onClick={() => setStage('tap')}>
            {copy.stack.tap.back}
          </button>
          {items.length === 0 ? (
            <button type="button" className="ds-link ds-link--quiet" onClick={useExample}>
              {copy.stack.listen.example}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
