'use client';

import type { Item } from '@distill/catalog';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBackHandler } from '../../../components/back-handler';
import { useGo } from '../../../components/onboarding/go';
import { Button, Skeleton } from '../../../components/ui';
import { fetchItems } from '../../../lib/catalog/actions';
import { copy } from '../../../lib/copy';
import { contextFor, flowState } from '../../../lib/followups/resolve';
import type { Asked } from '../../../lib/followups/resolve';
import { useProgress } from '../../../lib/progress/context';
import { PersonQuestion } from './person-question';
import { QuestionView, applyPatch } from './question-view';
import type { AnswerPatch } from './question-view';

const personIds = ['person:doctor', 'person:keep'] as const;
const protectedOrigins = new Set(['doctor', 'blood test']);

/**
 * Onboarding asks five things in all: the two about the person, then three about items. The rest
 * stay unanswered, land in "Your call", and are asked later in the app.
 */
export const itemQuestionCap = 3;

/** Biggest money first, with the one habit most worth reading on you moved up into the last place. */
export function byStake<
  T extends { stack: { monthlyCost: number }; item: Pick<Item, 'expectedEffect'> },
>(pairs: T[]): T[] {
  const sorted = [...pairs].sort((a, b) => b.stack.monthlyCost - a.stack.monthlyCost);
  const habit = [...sorted]
    .filter((p) => (p.item.expectedEffect ?? 0) >= 0.8)
    .sort((a, b) => (b.item.expectedEffect ?? 0) - (a.item.expectedEffect ?? 0))[0];
  if (!habit || sorted.indexOf(habit) < itemQuestionCap) return sorted;
  const rest = sorted.filter((p) => p !== habit);
  return [...rest.slice(0, itemQuestionCap - 1), habit, ...rest.slice(itemQuestionCap - 1)];
}

/**
 * One question per screen, generated from the person's stack and the engine's "unanswered
 * fields" signal. Answers already on file (demo data, a wearable) are shown once as a confirmation.
 */
export function QuestionsFlow({ loadItems = fetchItems }: { loadItems?: typeof fetchItems }) {
  const go = useGo();
  const { ready, progress, update } = useProgress();
  const [items, setItems] = useState<Map<string, Item> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const keys = useMemo(
    () => progress.items.map((i) => i.itemKey).filter((k): k is string => Boolean(k)),
    [progress.items],
  );
  const keyList = keys.join('|');

  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setFailed(false);
    loadItems(keys)
      .then((list) => {
        if (alive) setItems(new Map(list.map((i) => [i.key, i])));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [ready, keyList, attempt, loadItems]);

  const seen = useMemo(() => new Set(progress.seenQuestions), [progress.seenQuestions]);
  const ctx = useMemo(() => contextFor(progress), [progress]);
  const yours = useMemo(() => new Set(progress.dayOne.yours), [progress.dayOne.yours]);
  // What the person would never give up is theirs: no follow-ups, nothing to test.
  const pairs = useMemo(
    () =>
      items
        ? progress.items
            .filter((s) => s.itemKey && items.has(s.itemKey) && !yours.has(s.id))
            .map((s) => ({ stack: s, item: items.get(s.itemKey as string) as Item }))
        : [],
    [items, progress.items, yours],
  );
  const person = personIds.find((id) => !seen.has(id));
  const state = useMemo(() => {
    if (!items) return null;
    const full = flowState(byStake(pairs), ctx, seen);
    // A follow-up on the same field (the exact number after a range) shares its id: count it once.
    const left = itemQuestionCap - new Set(full.answered.map((a) => a.id)).size;
    if (left <= 0) return { ...full, current: null, waiting: 0 };
    return { ...full, waiting: Math.min(full.waiting, left - (full.current ? 1 : 0)) };
  }, [items, pairs, ctx, seen]);
  const done = Boolean(ready && items && state && !state.current && !person);
  const left = useRef(false);

  useEffect(() => {
    if (!done || left.current) return;
    left.current = true;
    go('number');
  }, [done, go]);

  useBackHandler(() => {
    if (progress.seenQuestions.length === 0) return false;
    update((p) => ({ ...p, seenQuestions: p.seenQuestions.slice(0, -1) }));
    return true;
  });

  function submit(asked: Asked, patch: AnswerPatch) {
    update((p) => {
      const idx = p.seenQuestions.indexOf(asked.id);
      const item = p.items.find((i) => i.id === asked.stackId);
      if (!item) return p;
      let changed = applyPatch(item, patch);
      if (patch.answers && 'form' in patch.answers && patch.answers.form !== item.answers.form) {
        // A different form can mean a different unit (juice in ml, extract in mg): the dose is asked again.
        const rest = { ...changed.answers };
        delete rest.dose;
        delete rest.servingAmount;
        delete rest.servingsPerDay;
        changed = { ...changed, answers: rest };
      }
      let seenNow = idx >= 0 ? p.seenQuestions : [...p.seenQuestions, asked.id];
      let next = changed;
      if (idx >= 0 && JSON.stringify(changed) !== JSON.stringify(item)) {
        // A revisited answer changed: later answers for this item may no longer apply.
        const later = p.seenQuestions
          .slice(idx + 1)
          .filter((id) => id.startsWith(`${asked.stackId}:`))
          .map((id) => id.slice(asked.stackId.length + 1));
        seenNow = seenNow.filter((id) => !later.some((f) => id === `${asked.stackId}:${f}`));
        const answers = { ...next.answers };
        const chips = { ...next.chips };
        for (const f of later) {
          delete answers[f];
          delete chips[f];
          if (f === 'dose') {
            delete answers.servingAmount;
            delete answers.servingsPerDay;
          }
        }
        next = { ...next, answers, chips, unknown: next.unknown.filter((u) => !later.includes(u)) };
      }
      return {
        ...p,
        seenQuestions: seenNow,
        items: p.items.map((i) => (i.id === asked.stackId ? next : i)),
      };
    });
  }

  if (failed)
    return (
      <section className="stack">
        <p className="notice" role="alert">
          {copy.questions.errorLoad}
        </p>
        <div className="actions-row">
          <Button onClick={() => setAttempt((a) => a + 1)}>{copy.common.tryAgain}</Button>
        </div>
      </section>
    );

  if (!ready || !items || !state || (!state.current && !person))
    return (
      <section className="stack" aria-busy="true" aria-live="polite">
        <p className="lede">{done ? copy.questions.reading : copy.common.loading}</p>
        <Skeleton kind="title" />
        <Skeleton kind="line" count={2} />
        <Skeleton kind="option" count={2} />
      </section>
    );

  const nameOf = (s: (typeof progress.items)[number]) =>
    (s.itemKey ? items.get(s.itemKey)?.name : s.customName) ?? '';
  if (person) {
    const k = personIds.indexOf(person) + 1;
    const n =
      personIds.length +
      new Set(state.answered.map((a) => a.id)).size +
      (state.current ? 1 + state.waiting : 0);
    const seeOnce = () => update((p) => ({ ...p, seenQuestions: [...p.seenQuestions, person] }));
    if (person === 'person:doctor') {
      const options = progress.items
        .filter((s) => !s.dataSource)
        .map((s) => ({ id: s.id, name: nameOf(s) }));
      const selected = new Set(
        progress.items.filter((s) => s.origin && protectedOrigins.has(s.origin)).map((s) => s.id),
      );
      return (
        <div className="swap" key={person}>
          <PersonQuestion
            kind="doctor"
            options={options}
            selected={selected}
            count={{ k, n }}
            onToggle={(id) =>
              update((p) => ({
                ...p,
                items: p.items.map((s) =>
                  s.id !== id
                    ? s
                    : {
                        ...s,
                        origin: s.origin && protectedOrigins.has(s.origin) ? undefined : 'doctor',
                      },
                ),
              }))
            }
            onNone={() =>
              update((p) => ({
                ...p,
                items: p.items.map((s) =>
                  s.origin && protectedOrigins.has(s.origin) ? { ...s, origin: undefined } : s,
                ),
              }))
            }
            onContinue={seeOnce}
          />
        </div>
      );
    }
    const options = progress.items
      .filter((s) => !s.dataSource && !(s.origin && protectedOrigins.has(s.origin)))
      .map((s) => ({ id: s.id, name: nameOf(s) }));
    return (
      <div className="swap" key={person}>
        <PersonQuestion
          kind="keep"
          options={options}
          selected={yours}
          count={{ k, n }}
          onToggle={(id) =>
            update((p) => ({
              ...p,
              dayOne: {
                ...p.dayOne,
                yours: p.dayOne.yours.includes(id)
                  ? p.dayOne.yours.filter((y) => y !== id)
                  : [...p.dayOne.yours, id],
              },
            }))
          }
          onContinue={seeOnce}
        />
      </div>
    );
  }

  const current = state.current;
  if (!current) return null;
  const k = personIds.length + new Set(state.answered.map((a) => a.id)).size + 1;
  const n = k + state.waiting;
  return (
    <div className="swap" key={current.id}>
      <QuestionView
        asked={current}
        count={{ k, n }}
        goals={progress.goals}
        onSubmit={(patch) => submit(current, patch)}
      />
    </div>
  );
}
