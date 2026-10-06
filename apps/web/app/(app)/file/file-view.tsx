'use client';

import type { Item } from '@distill/catalog';
import { useEffect, useMemo, useState } from 'react';
import { Button, Skeleton } from '../../../components/ui';
import { fetchItems } from '../../../lib/catalog/actions';
import { copy } from '../../../lib/copy';
import { buildRoutedStack } from '../../../lib/data/routed';
import type { Verdict } from '../../../lib/data/types';
import { useDataSource } from '../../../lib/data/use-source';
import { useProgress } from '../../../lib/progress/context';

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/** Two lists, what you cut and what's yours, with a count and a bill that only go down. */
export function FileView({
  loadItems = fetchItems,
  loadTemplates,
}: {
  loadItems?: typeof fetchItems;
  loadTemplates?: Parameters<typeof useDataSource>[1];
}) {
  const { ready, progress } = useProgress();
  const { source, failed, retry } = useDataSource(progress, loadTemplates);
  const [catalogFailed, setCatalogFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [items, setItems] = useState<Map<string, Item> | null>(null);
  const [verdicts, setVerdicts] = useState<Verdict[] | null>(null);
  const keys = useMemo(
    () => progress.items.map((i) => i.itemKey).filter((k): k is string => Boolean(k)),
    [progress.items],
  );
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setCatalogFailed(false);
    loadItems(keys)
      .then((list) => alive && setItems(new Map(list.map((i) => [i.key, i]))))
      .catch(() => alive && setCatalogFailed(true));
    return () => {
      alive = false;
    };
  }, [ready, keys, loadItems, attempt]);
  useEffect(() => {
    if (!ready || !source) return;
    let alive = true;
    source.verdicts(progress).then((v) => alive && setVerdicts(v));
    return () => {
      alive = false;
    };
  }, [ready, source, progress]);

  if (failed || catalogFailed)
    return (
      <section className="stack">
        <p className="notice" role="alert">
          Your file could not be loaded.
        </p>
        <Button
          onClick={() => {
            retry();
            setAttempt((a) => a + 1);
          }}
        >
          Retry
        </Button>
      </section>
    );
  if (!ready || !items || !verdicts)
    return (
      <section className="stack" aria-busy="true">
        <h1>{copy.file.title}</h1>
        <Skeleton kind="title" />
        <Skeleton kind="line" count={3} />
      </section>
    );

  const routed = buildRoutedStack(progress, items);
  const byId = new Map(routed.items.map((r) => [r.stackItemId, r]));
  const cut = progress.items.filter((i) => i.status === 'cut');
  const remaining = progress.items.filter((i) => i.status !== 'cut');
  const bill = remaining.reduce((t, i) => t + i.monthlyCost, 0);
  const wasBill = progress.items.reduce((t, i) => t + i.monthlyCost, 0);
  const keptVerdicts = verdicts.filter(
    (v) => v.word === 'Kept' || progress.verdictChoices[v.id] === 'kept',
  );
  const dayOneKeeps = progress.items.filter(
    (i) => i.status === 'kept' && !keptVerdicts.some((v) => v.itemKey === i.itemKey),
  );
  const verdictFor = (itemKey: string | null) => verdicts.find((v) => v.itemKey === itemKey);

  return (
    <section className="stack">
      <h1>{copy.file.title}</h1>
      <div className="score" aria-live="polite">
        <span>
          <b>{copy.file.things(remaining.length)}</b>
          <small>{copy.file.was(progress.items.length)}</small>
        </span>
        <span>
          <b>{copy.file.aMonth(money(bill))}</b>
          <small>{copy.file.wasMoney(money(wasBill))}</small>
        </span>
      </div>
      <div className="file-cols">
        <section className="stack-tight" aria-labelledby="f-cut">
          <h2 id="f-cut" style={{ fontSize: 22 }}>
            {copy.file.cutTitle}
          </h2>
          {cut.length === 0 ? (
            <p className="muted">{copy.file.cutEmpty}</p>
          ) : (
            <ul className="file-list">
              {cut.map((i) => {
                const r = byId.get(i.id);
                const v = verdictFor(i.itemKey);
                const why = v
                  ? v.word
                  : r?.landing.reason
                    ? copy.dayOne.reasons[r.landing.reason]
                    : copy.file.dayOneTag;
                return (
                  <li key={i.id}>
                    <span>
                      {r?.name ?? i.customName}
                      <small>{why}</small>
                    </span>
                    <span className="mono">{copy.dayOne.perMonth(money(i.monthlyCost))}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <section className="stack-tight" aria-labelledby="f-yours">
          <h2 id="f-yours" style={{ fontSize: 22 }}>
            {copy.file.yoursTitle}
          </h2>
          {keptVerdicts.length === 0 && dayOneKeeps.length === 0 ? (
            <p className="muted">{copy.file.yoursEmpty}</p>
          ) : (
            <ul className="file-list">
              {keptVerdicts.map((v) => (
                <li key={v.id}>
                  <span>
                    {v.name}
                    <small>{v.word}</small>
                  </span>
                  <span className="mono">
                    {v.change === null
                      ? 'Measurement unavailable'
                      : `${v.change < 0 ? '−' : '+'}${Math.abs(v.change)} ${v.unit}`}
                  </span>
                </li>
              ))}
              {dayOneKeeps.map((i) => (
                <li key={i.id}>
                  <span>
                    {byId.get(i.id)?.name ?? i.customName}
                    <small>{copy.file.keptOnDayOne}</small>
                  </span>
                  <span className="mono">{copy.dayOne.perMonth(money(i.monthlyCost))}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </section>
  );
}
