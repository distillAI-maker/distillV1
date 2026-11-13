'use client';

import { Fragment, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useBackHandler } from '../../../components/back-handler';
import { useGo } from '../../../components/onboarding/go';
import { useStepNumber } from '../../../components/onboarding/step-number';
import { Arrow, Bubble, Disclaimer } from '../../../components/ds/ui';
import {
  allChips,
  commonGroups,
  commonRow,
  isChip,
  isOtherRow,
  isParent,
  type CommonChip,
  type CommonGroupId,
  type CommonItem,
  type CommonParent,
} from '../../../lib/catalog/common';
import { displayName, shortName } from '../../../lib/catalog/short-names';
import { copy } from '../../../lib/copy';
import { demoGoals, demoStack } from '../../../lib/data/demo/stack';
import { env } from '../../../lib/env';
import { useProgress } from '../../../lib/progress/context';
import { newItemId } from '../../../lib/progress/types';
import type { Origin, StackItem } from '../../../lib/progress/types';
import { matchText } from '../../../lib/search/match';
import { track, useScreen } from '../../../lib/track';
import type { IndexEntry } from '../../../lib/search/match';
import { Typeahead } from './typeahead';

const protectedOrigins: Origin[] = ['doctor', 'blood test'];

/**
 * The taps, in three short pages that each fit on a phone without scrolling: what they take, what they
 * pay for, and everything else. Each page holds two of the common groups.
 */
const tapPages: readonly (readonly CommonGroupId[])[] = [
  ['supplements', 'food'],
  ['memberships', 'apps'],
  ['habits', 'body'],
];
const groupById = new Map(commonGroups.map((g) => [g.id, g]));
/** How far a finger has to travel sideways to turn the page. */
const SWIPE_PX = 50;

/** The last chip under a general one: tap "Other", type the name, and the chip wears it. Tap again to take it out. */
function OtherOption({ ask, name, onName }: { ask: string; name: string | null; onName: (name: string | null) => void }) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const id = useId();
  const done = () => {
    const text = draft.trim();
    if (text) onName(text);
    setDraft('');
    setTyping(false);
  };
  if (typing)
    return (
      <form
        className="st-add"
        onSubmit={(e) => {
          e.preventDefault();
          done();
        }}
      >
        <label className="sr-only" htmlFor={id}>
          {ask}
        </label>
        <input
          id={id}
          autoFocus
          value={draft}
          maxLength={60}
          enterKeyHint="done"
          placeholder={copy.stack.tap.otherPlaceholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={done}
        />
      </form>
    );
  return (
    <Bubble on={!!name} onClick={() => (name ? onName(null) : setTyping(true))}>
      {name ?? copy.stack.tap.other}
    </Bubble>
  );
}

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
  /** Which page of taps shows. */
  const [page, setPage] = useState(0);
  const touch = useRef<{ x: number; y: number } | null>(null);
  /** While a cost is being typed, the list keeps its order so the row doesn't jump away. */
  const [frozen, setFrozen] = useState<string[] | null>(null);
  /** General chips (Gym) opened to show the specific ones under them. */
  const [opened, setOpened] = useState<ReadonlySet<string>>(new Set());
  const notesId = useId();

  // Someone coming back to a list they started lands on the list, not the blank page.
  useEffect(() => {
    if (ready && stage === null) setStage(progress.items.length ? 'edit' : 'tap');
  }, [ready, stage, progress.items.length]);

  // Tapping is step 1; the list ("anything we missed") is step 2, and Back from it returns to the taps.
  useStepNumber(stage === 'edit' ? 2 : 1);
  useScreen(stage === 'tap' ? 'stack_tap' : stage === 'listen' ? 'stack_talk' : stage === 'edit' ? 'stack_list' : null);
  useBackHandler(
    stage === 'edit' || stage === 'listen'
      ? () => {
          setStage('tap');
          return true;
        }
      : stage === 'tap' && page > 0
        ? () => {
            setPage(page - 1);
            return true;
          }
        : null,
  );

  // Each stage and page starts at its title.
  useEffect(() => {
    if (stage) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [stage, page]);

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
  const chipOn = (item: CommonItem) => items.some((i) => isChip(i, item));
  /** Takes rows out of their stack, and out of what they'd never give up. */
  const without = (p: typeof progress, gone: (i: StackItem) => boolean) => {
    const ids = new Set(p.items.filter(gone).map((i) => i.id));
    return {
      ...p,
      items: p.items.filter((i) => !ids.has(i.id)),
      dayOne: { ...p.dayOne, yours: p.dayOne.yours.filter((y) => !ids.has(y)) },
    };
  };
  /** A chip: on adds it at the table's cost, off takes it out again. */
  function toggleCommon(item: CommonItem) {
    setNeedOne(false);
    update((p) => {
      if (p.items.some((i) => isChip(i, item))) return without(p, (i) => isChip(i, item));
      return { ...p, items: [...p.items, commonRow(item, p.items.length)] };
    });
  }
  /** A general chip: on adds the general row and opens the specific ones; off takes them all out. */
  function toggleParent(parent: CommonParent) {
    setNeedOne(false);
    const family = allChips([parent]);
    const inFamily = (i: StackItem) => family.some((c) => isChip(i, c)) || isOtherRow(i, parent);
    const on = items.some(inFamily);
    setOpened((o) => {
      const next = new Set(o);
      if (on) next.delete(parent.key);
      else next.add(parent.key);
      return next;
    });
    update((p) => {
      if (on) return without(p, inFamily);
      return { ...p, items: [...p.items, commonRow(parent, p.items.length)] };
    });
  }
  /** "Other": the one they name themselves stands in for the general row, as a specific chip does. */
  function setOther(parent: CommonParent, name: string | null) {
    setNeedOne(false);
    update((p) => {
      const rest = without(p, (i) => isOtherRow(i, parent) || (!!name && isChip(i, parent)));
      if (!name) return rest;
      return { ...rest, items: [...rest.items, { ...commonRow(parent, rest.items.length), label: name }] };
    });
  }
  /** A specific chip under a general one: picking it stands in for the general row. */
  function toggleOption(parent: CommonParent, item: CommonItem) {
    setNeedOne(false);
    update((p) => {
      if (p.items.some((i) => isChip(i, item))) return without(p, (i) => isChip(i, item));
      const rest = without(p, (i) => isChip(i, parent) && !parent.options.some((o) => isChip(i, o)));
      return { ...rest, items: [...rest.items, commonRow(item, rest.items.length)] };
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
  /**
   * The example stack is for the team only (NEXT_PUBLIC_DEV_TOOLS): people put in their own. It
   * starts with nothing marked as from a feed, and without the wearable, as everyone else does.
   */
  const example = env.devTools && items.length === 0;
  function useExample() {
    const fresh = demoStack()
      .filter((i) => !i.dataSource)
      .map((i) => {
        if (i.origin !== 'online') return i;
        const rest = { ...i };
        delete rest.origin;
        return rest;
      });
    update({ items: fresh, goals: demoGoals, prefilledFrom: 'demo' });
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
    const last = page === tapPages.length - 1;
    const turn = (to: number) => setPage(Math.max(0, Math.min(tapPages.length - 1, to)));
    const chip = (item: CommonChip) => {
      if (!isParent(item))
        return (
          <Bubble key={item.text} on={chipOn(item)} onClick={() => toggleCommon(item)}>
            {item.text}
          </Bubble>
        );
      const other = items.find((i) => isOtherRow(i, item));
      const on = allChips([item]).some(chipOn) || !!other;
      const open = on || opened.has(item.key);
      // The specific ones open right under the general chip, on a line of their own.
      return (
        <Fragment key={item.text}>
          <Bubble on={on} expanded={open} onClick={() => toggleParent(item)}>
            {item.text}
          </Bubble>
          {open ? (
            <div className="ob-sub">
              <span className="ob-sub-ask">{item.ask}</span>
              <div className="ds-bubbles" role="group" aria-label={item.ask}>
                {item.options.map((o) => (
                  <Bubble key={o.text} on={chipOn(o)} onClick={() => toggleOption(item, o)}>
                    {o.text}
                  </Bubble>
                ))}
                <OtherOption ask={item.ask} name={other?.label ?? null} onName={(n) => setOther(item, n)} />
              </div>
            </div>
          ) : null}
        </Fragment>
      );
    };
    return (
      <>
        <div
          className="ob-content ob-tap"
          onTouchStart={(e) => {
            const t = e.touches[0];
            touch.current = t ? { x: t.clientX, y: t.clientY } : null;
          }}
          onTouchEnd={(e) => {
            const from = touch.current;
            const t = e.changedTouches[0];
            touch.current = null;
            if (!from || !t) return;
            const dx = t.clientX - from.x;
            if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(t.clientY - from.y) * 1.5) turn(page + (dx < 0 ? 1 : -1));
          }}
        >
          <header className="ob-heading ob-tap-heading">
            <span className="ob-tap-kicker">{copy.stack.tap.title}</span>
            <h1>{copy.stack.tap.pages[page]}</h1>
          </header>
          <div key={page} className="ob-groups ob-tap-page">
            {tapPages[page]!.map((id) => {
              const g = groupById.get(id)!;
              return (
                <section key={id} className="ob-group">
                  <h2>{copy.stack.tap.groups[id]}</h2>
                  <div className="ds-bubbles" role="group" aria-label={copy.stack.tap.groups[id]}>
                    {g.items.map(chip)}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
        <div className="ob-sticky">
          <div className="ob-tap-dots" role="tablist" aria-label={copy.stack.tap.pageOf(page + 1, tapPages.length)}>
            {tapPages.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === page}
                aria-label={copy.stack.tap.pages[i]}
                onClick={() => turn(i)}
              />
            ))}
          </div>
          <button type="button" className="ds-primary" onClick={() => (last ? setStage('edit') : turn(page + 1))}>
            {copy.stack.tap.next}
            <Arrow />
          </button>
          <div className="ob-other">
            {page === 0 ? (
              <button type="button" className="ds-link" onClick={() => setStage('listen')}>
                {copy.stack.tap.talk}
              </button>
            ) : (
              <button type="button" className="ds-link ds-link--quiet" onClick={() => setStage('edit')}>
                {copy.stack.tap.skip}
              </button>
            )}
            {example ? (
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
            {example ? (
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
  // What they pay for, biggest first, then the free things as chips. The order holds while a cost is typed.
  const byCost = [...items].sort((a, b) => b.monthlyCost - a.monthlyCost || a.position - b.position);
  const paid = frozen
    ? frozen.map((id) => items.find((i) => i.id === id)).filter((i): i is StackItem => !!i)
    : byCost.filter((i) => i.monthlyCost > 0);
  const free = items.filter((i) => !paid.includes(i));

  return (
    <>
      <div className="ob-content">
        <header className="ob-heading">
          <h1>{copy.stack.edit.title}</h1>
        </header>
        {progress.prefilledFrom === 'demo' ? <p className="ds-notice">{copy.stack.demoLine}</p> : null}

        <Typeahead
          index={index}
          listed={listed}
          onPick={(e) => addCatalog([e])}
          onCustom={(name) => setCustom({ open: true, name, cost: '' })}
        />

        {paid.length ? (
          <section className="ob-ledger" aria-labelledby="stack-paid">
            <h2 id="stack-paid" className="ob-ledger-label">
              {copy.stack.edit.paid}
            </h2>
            <ul>
              {paid.map((row) => {
                const name = nameOf(row);
                const isProtected = row.origin ? protectedOrigins.includes(row.origin) : false;
                return (
                  <li key={row.id} className="ob-row">
                    <span className="ob-row-name">
                      {name}
                      {isProtected ? <span className="ob-tag">{copy.stack.protectedTag}</span> : null}
                    </span>
                    <label className="ob-cost">
                      <span aria-hidden="true">$</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step={1}
                        aria-label={copy.stack.costFor(name)}
                        style={{ width: `${Math.max(2, String(row.monthlyCost).length) + 0.4}ch` }}
                        value={Number.isFinite(row.monthlyCost) ? row.monthlyCost : ''}
                        onFocus={(e) => {
                          setFrozen(paid.map((i) => i.id));
                          e.currentTarget.select();
                        }}
                        onBlur={() => setFrozen(null)}
                        onChange={(e) => {
                          const n = e.target.value === '' ? 0 : Number(e.target.value);
                          patch(row.id, { monthlyCost: Number.isFinite(n) && n >= 0 ? n : 0 });
                        }}
                      />
                      <span aria-hidden="true" className="ob-cost-per">
                        {copy.stack.edit.perMonth}
                      </span>
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
        ) : null}

        {free.length ? (
          <section className="ob-ledger" aria-labelledby="stack-free">
            <h2 id="stack-free" className="ob-ledger-label">
              {copy.stack.edit.free}
            </h2>
            <ul className="ob-free">
              {free.map((row) => {
                const name = nameOf(row);
                return (
                  <li key={row.id} className="ob-free-chip">
                    <span>{name}</span>
                    <button type="button" aria-label={copy.stack.remove(name)} onClick={() => remove(row.id)}>
                      <span aria-hidden="true">×</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null}

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
          {example ? (
            <button type="button" className="ds-link ds-link--quiet" onClick={useExample}>
              {copy.stack.listen.example}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}
