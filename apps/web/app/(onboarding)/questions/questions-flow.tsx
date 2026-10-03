'use client';

import type { Item } from '@distill/catalog';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useBackHandler } from '../../../components/back-handler';
import { Button, Skeleton } from '../../../components/ui';
import { fetchItems } from '../../../lib/catalog/actions';
import { copy } from '../../../lib/copy';
import { contextFor, flowState } from '../../../lib/followups/resolve';
import type { Asked } from '../../../lib/followups/resolve';
import { useProgress } from '../../../lib/progress/context';
import { QuestionView, applyPatch } from './question-view';
import type { AnswerPatch } from './question-view';

/**
 * One question per screen, generated from the person's stack and the engine's "unanswered
 * fields" signal. Answers already on file (demo data, a wearable) are shown once as a confirmation.
 */
export function QuestionsFlow({ loadItems = fetchItems }: { loadItems?: typeof fetchItems }) {
  const router = useRouter();
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
  const pairs = useMemo(
    () =>
      items
        ? progress.items
            .filter((s) => s.itemKey && items.has(s.itemKey))
            .map((s) => ({ stack: s, item: items.get(s.itemKey as string) as Item }))
        : [],
    [items, progress.items],
  );
  const state = useMemo(() => (items ? flowState(pairs, ctx, seen) : null), [items, pairs, ctx, seen]);
  const done = Boolean(ready && items && state && !state.current);
  const left = useRef(false);

  useEffect(() => {
    if (!done || left.current) return;
    left.current = true;
    update({ step: 'day-one' });
    router.push('/day-one');
  }, [done, router, update]);

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
      return { ...p, seenQuestions: seenNow, items: p.items.map((i) => (i.id === asked.stackId ? next : i)) };
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

  if (!ready || !items || !state || !state.current)
    return (
      <section className="stack" aria-busy="true" aria-live="polite">
        <p className="lede">{done ? copy.questions.reading : copy.common.loading}</p>
        <Skeleton kind="title" />
        <Skeleton kind="line" count={2} />
        <Skeleton kind="option" count={2} />
      </section>
    );

  const k = state.answered.length + 1;
  const n = k + state.waiting;
  return (
    <div className="swap" key={state.current.id}>
      <QuestionView
        asked={state.current}
        count={{ k, n }}
        goals={progress.goals}
        onSubmit={(patch) => submit(state.current as Asked, patch)}
      />
    </div>
  );
}
