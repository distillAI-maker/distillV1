'use client';

import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Button } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { search } from '../../../lib/search/match';
import type { IndexEntry } from '../../../lib/search/match';

/** The catalog search, as an ARIA combobox: arrows move, Enter adds, Escape closes. */
export function Typeahead({
  index,
  listed,
  onPick,
  onCustom,
}: {
  index: IndexEntry[];
  listed: Set<string>;
  onPick: (entry: IndexEntry) => void;
  onCustom: (name: string) => void;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const input = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = q.trim();
  const results = open && query.length >= 2 ? search(query, index, 8) : [];
  const showEmpty = open && query.length >= 2 && results.length === 0;
  const expanded = results.length > 0 || showEmpty;

  function pick(entry: IndexEntry) {
    onPick(entry);
    setQ('');
    setOpen(false);
    setActive(0);
    input.current?.focus();
  }
  function custom() {
    onCustom(query);
    setQ('');
    setOpen(false);
  }
  function onKeyDown(ev: KeyboardEvent<HTMLInputElement>) {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      if (!open) setOpen(true);
      else setActive((a) => Math.min(a + 1, Math.max(0, results.length - 1)));
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (ev.key === 'Enter') {
      const hit = results[active];
      if (hit) {
        ev.preventDefault();
        pick(hit);
      } else if (showEmpty) {
        ev.preventDefault();
        custom();
      }
    } else if (ev.key === 'Escape') {
      setOpen(false);
    }
  }

  return (
    <div className="field combo">
      <label htmlFor={id}>{copy.stack.searchLabel}</label>
      <input
        ref={input}
        id={id}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={results[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        spellCheck={false}
        placeholder={copy.stack.searchPlaceholder}
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {expanded ? (
        <div className="listbox" role="listbox" id={listId} aria-label={copy.stack.resultsLabel}>
          {results.map((r, i) => (
            <div
              key={r.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(r)}
            >
              <span>{r.name}</span>
              <small>
                {listed.has(r.key)
                  ? copy.stack.listedTag
                  : `${copy.stack.categories[r.category as keyof typeof copy.stack.categories] ?? r.category} · $${r.cost}`}
              </small>
            </div>
          ))}
          {showEmpty ? (
            <div className="empty">
              <span>{copy.stack.noMatch}</span>
              <Button size="sm" variant="ghost" onMouseDown={(e) => e.preventDefault()} onClick={custom}>
                {copy.stack.addAsCustom(query)}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
