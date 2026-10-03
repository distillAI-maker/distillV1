'use client';

import type { Item } from '@distill/catalog';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { CountUp } from '../../../components/count-up';
import { Icon } from '../../../components/icon';
import type { IconName } from '../../../components/icon';
import { Button, ButtonLink, Chip, Field, Skeleton } from '../../../components/ui';
import { fetchItems } from '../../../lib/catalog/actions';
import { copy } from '../../../lib/copy';
import { buildRoutedStack, groupOf, statusesAfterDayOne, summarise } from '../../../lib/data/routed';
import type { Group } from '../../../lib/data/routed';
import type { RoutedItem, RoutedStack } from '../../../lib/data/types';
import { env } from '../../../lib/env';
import { useProgress } from '../../../lib/progress/context';

const groupOrder: Group[] = ['drop', 'test', 'cant', 'keep', 'protected', 'unread'];
const groupIcon: Record<Group, IconName> = {
  drop: 'checkc',
  test: 'flask',
  cant: 'eyeoff',
  keep: 'heart',
  protected: 'shield',
  unread: 'clock',
};

const money = (n: number) => Math.round(n).toLocaleString('en-US');

export function DayOne({ loadItems = fetchItems }: { loadItems?: typeof fetchItems }) {
  const router = useRouter();
  const { ready, progress, update } = useProgress();
  const [items, setItems] = useState<Map<string, Item> | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [months, setMonths] = useState<string>(progress.dayOne.months != null ? String(progress.dayOne.months) : '');
  const [picking, setPicking] = useState(false);

  const keys = useMemo(
    () => progress.items.map((i) => i.itemKey).filter((k): k is string => Boolean(k)),
    [progress.items],
  );
  useEffect(() => {
    if (!ready) return;
    let alive = true;
    setFailed(false);
    loadItems(keys)
      .then((list) => alive && setItems(new Map(list.map((i) => [i.key, i]))))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [ready, keys, attempt, loadItems]);

  const routed: RoutedStack | null = useMemo(
    () => (items ? buildRoutedStack(progress, items) : null),
    [items, progress],
  );
  const summary = useMemo(() => (routed ? summarise(routed, progress.dayOne) : null), [routed, progress.dayOne]);

  const dayOne = progress.dayOne;
  const setDayOne = (patch: Partial<typeof dayOne>) => update((p) => ({ ...p, dayOne: { ...p.dayOne, ...patch } }));
  const toggleIn = (list: 'keepAnyway' | 'runAnyway', id: string, on: boolean) =>
    setDayOne({ [list]: on ? [...new Set([...dayOne[list], id])] : dayOne[list].filter((x) => x !== id) });

  function start() {
    if (!routed) return;
    const statuses = statusesAfterDayOne(routed, dayOne);
    const m = months.trim() === '' ? null : Number(months);
    update((p) => ({
      ...p,
      step: 'done',
      dayOne: { ...p.dayOne, started: true, months: Number.isFinite(m as number) ? m : null },
      items: p.items.map((i) => ({ ...i, status: statuses[i.id] ?? i.status })),
    }));
    router.push('/today');
  }

  if (failed)
    return (
      <section className="stack">
        <p className="notice" role="alert">
          {copy.dayOne.error}
        </p>
        <div className="actions-row">
          <Button onClick={() => setAttempt((a) => a + 1)}>{copy.common.tryAgain}</Button>
        </div>
      </section>
    );
  if (!ready || !routed || !summary)
    return (
      <section className="stack" aria-busy="true">
        <p className="lede">{copy.dayOne.reading}</p>
        <Skeleton kind="title" count={2} />
        <Skeleton kind="option" count={3} />
      </section>
    );
  if (routed.items.length === 0)
    return (
      <section className="stack">
        <h2>{copy.dayOne.emptyTitle}</h2>
        <p className="lede">{copy.dayOne.emptyLine}</p>
        <div className="actions-row">
          <ButtonLink href="/stack" variant="ghost">
            {copy.dayOne.backToStack}
          </ButtonLink>
        </div>
      </section>
    );

  const byGroup = new Map<Group, RoutedItem[]>();
  for (const r of routed.items) {
    const g = groupOf(r, routed, dayOne);
    byGroup.set(g, [...(byGroup.get(g) ?? []), r]);
  }
  const inPair = new Set(routed.overlaps.flatMap((o) => o.keys));
  const first = routed.queue.find((q) => q.itemKey === (dayOne.firstExperiment ?? routed.queue[0]?.itemKey)) ?? routed.queue[0];
  const firstItem = first ? routed.items.find((r) => r.itemKey === first.itemKey) : undefined;

  return (
    <div className="stack" style={{ gap: 28 }}>
      <section className="reveal" aria-live="polite">
        <h1 className="display">
          <CountUp to={summary.count} format={copy.dayOne.things} />
        </h1>
        <p className="display" style={{ fontSize: 'clamp(36px,8vw,56px)' }}>
          <CountUp to={summary.monthlyTotal} format={(n) => copy.dayOne.aMonth(money(n))} />
        </p>
        <p className="lede">
          {copy.dayOne.line({ ...summary, monthlyBack: money(summary.monthlyBack) })}
        </p>
        <div className="actions-row" style={{ marginTop: 8 }}>
          <a className="btn btn-ghost btn-sm" href="#groups">
            {copy.dayOne.showMe}
            <Icon name="down" size={16} />
          </a>
        </div>
      </section>

      <div id="groups" className="stack" style={{ gap: 28 }}>
        {groupOrder.map((g) => {
          const rows = byGroup.get(g) ?? [];
          if (!rows.length) return null;
          const head = copy.dayOne.groups[g];
          return (
            <section key={g} aria-labelledby={`g-${g}`} className="stack">
              <div className="group-head">
                <h2 id={`g-${g}`}>
                  <Icon name={groupIcon[g]} />
                  {head.title}
                </h2>
                <p>{head.line}</p>
              </div>
              <div className="cards">
                {g === 'drop'
                  ? routed.overlaps.map((pair) => {
                      const a = routed.items.find((r) => r.itemKey === pair.keys[0])!;
                      const b = routed.items.find((r) => r.itemKey === pair.keys[1])!;
                      const kept = dayOne.overlapChoices[pair.group] ?? pair.keys.find((k) => k !== pair.suggestedDrop);
                      const stays = pair.keys.find((k) => k !== pair.suggestedDrop) as string;
                      const goes = pair.suggestedDrop;
                      const nameOf = (k: string) => routed.items.find((r) => r.itemKey === k)?.name ?? k;
                      return (
                        <div key={pair.group} className="glass dcard pair" role="group" aria-label={copy.dayOne.overlapTitle}>
                          <div>
                            <h3>{copy.dayOne.overlapTitle}</h3>
                            <p className="muted" style={{ fontSize: 15 }}>
                              {copy.dayOne.overlapLine}
                            </p>
                          </div>
                          <div className="two">
                            {[a, b].map((r) => (
                              <div key={r.stackItemId} className="one">
                                <span className="name">{r.name}</span>
                                <span className="facts">
                                  <span>{pair.facts[r.itemKey as string]}</span>
                                  <span>{copy.dayOne.perMonth(money(r.monthlyCost))}</span>
                                </span>
                              </div>
                            ))}
                          </div>
                          <div className="chips" role="radiogroup" aria-label={copy.dayOne.overlapTitle}>
                            {pair.keys.map((k) => (
                              <Chip
                                key={k}
                                radio
                                selected={kept === k}
                                onClick={() => setDayOne({ overlapChoices: { ...dayOne.overlapChoices, [pair.group]: k } })}
                              >
                                {copy.dayOne.keepThis(nameOf(k))}
                              </Chip>
                            ))}
                          </div>
                          <p className="muted" style={{ fontSize: 14 }}>
                            {copy.dayOne.suggested(pair.facts[stays] ?? '', pair.facts[goes] ?? '')}
                          </p>
                        </div>
                      );
                    })
                  : null}
                {rows
                  .filter((r) => !(g === 'drop' && r.itemKey && inPair.has(r.itemKey)))
                  .map((r) => (
                    <ItemCard
                      key={r.stackItemId}
                      r={r}
                      group={g}
                      keepAnyway={dayOne.keepAnyway.includes(r.stackItemId)}
                      runAnyway={dayOne.runAnyway.includes(r.stackItemId)}
                      onKeep={(on) => toggleIn('keepAnyway', r.stackItemId, on)}
                      onRun={(on) => toggleIn('runAnyway', r.stackItemId, on)}
                      first={first?.itemKey === r.itemKey}
                    />
                  ))}
              </div>
            </section>
          );
        })}
      </div>

      {first && firstItem ? (
        <section className="glass end-card" aria-labelledby="first-h">
          <h2 id="first-h" style={{ fontSize: 22 }}>
            {copy.dayOne.firstTitle}
          </h2>
          <p className="first">{firstItem.name}</p>
          <div className="lines">
            <p>{copy.dayOne.firstLine1}</p>
            <p>{copy.dayOne.firstLine2}</p>
            {first.observeOnly ? <p>{copy.dayOne.observeLine}</p> : null}
          </div>
          <Field
            label={copy.dayOne.monthsQ}
            type="number"
            inputMode="numeric"
            min={0}
            max={600}
            step={1}
            unit={copy.dayOne.monthsUnit}
            value={months}
            onChange={(e) => setMonths(e.target.value)}
          />
          <div className="actions-row">
            <Button onClick={start}>{copy.dayOne.start}</Button>
            {routed.queue.length > 1 ? (
              <Button variant="ghost" onClick={() => setPicking((p) => !p)} aria-expanded={picking}>
                {copy.dayOne.notThisOne}
              </Button>
            ) : null}
          </div>
          {picking ? (
            <div className="stack-tight">
              <p className="muted" style={{ fontSize: 15 }}>
                {copy.dayOne.pickAnother}
              </p>
              <div className="chips" role="radiogroup" aria-label={copy.dayOne.pickAnother}>
                {routed.queue.map((q) => (
                  <Chip
                    key={q.itemKey}
                    radio
                    selected={first.itemKey === q.itemKey}
                    onClick={() => {
                      setDayOne({ firstExperiment: q.itemKey });
                      setPicking(false);
                    }}
                  >
                    {routed.items.find((r) => r.itemKey === q.itemKey)?.name ?? q.itemKey}
                  </Chip>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

function ItemCard({
  r,
  group,
  keepAnyway,
  runAnyway,
  onKeep,
  onRun,
  first,
}: {
  r: RoutedItem;
  group: Group;
  keepAnyway: boolean;
  runAnyway: boolean;
  onKeep: (on: boolean) => void;
  onRun: (on: boolean) => void;
  first: boolean;
}) {
  const l = r.landing;
  const chanceWord = l.chance && l.chance !== 'not tested' && l.chance !== 'not in two weeks' ? l.chance : null;
  return (
    <article className="glass dcard" aria-label={r.name}>
      <div className="top">
        <div>
          {l.reason ? <div className="reason">{copy.dayOne.reasons[l.reason]}</div> : null}
          {first ? <div className="reason">{copy.dayOne.firstTitle}</div> : null}
          <div className="name">{r.name}</div>
        </div>
        {group === 'protected' ? null : (
          <span className="cost">
            {group === 'cant' ? copy.dayOne.perYear(money(r.monthlyCost * 12)) : copy.dayOne.perMonth(money(r.monthlyCost))}
          </span>
        )}
      </div>
      {l.sentence ? <p className="say">{l.sentence}</p> : null}
      {group === 'test' && l.metric ? (
        <div className="facts">
          <span>{copy.dayOne.watch(l.metric)}</span>
          {chanceWord ? <span>{copy.dayOne.chance(chanceWord)}</span> : null}
        </div>
      ) : null}
      {l.hypothesis ? (
        <div className="hyp">
          <span className="label">{copy.dayOne.hypothesisLabel}</span>
          <span>{l.hypothesis}</span>
        </div>
      ) : null}
      {l.safety ? (
        <div className="safety">
          <b>{copy.dayOne.safety}</b>
          {l.safety}
        </div>
      ) : null}
      {l.unverified && env.showUnverified ? <span className="tag">{copy.dayOne.beingChecked}</span> : null}
      {l.tier === 'T2' ? (
        <div className="switch" role="radiogroup" aria-label={r.name}>
          <Chip radio selected={!keepAnyway} onClick={() => onKeep(false)}>
            {copy.dayOne.letItGo}
          </Chip>
          <Chip radio selected={keepAnyway} onClick={() => onKeep(true)}>
            {copy.dayOne.keepItAnyway}
          </Chip>
        </div>
      ) : null}
      {l.tier === 'T3_TOO_SMALL' ? (
        <div className="switch" role="radiogroup" aria-label={r.name}>
          <Chip radio selected={!runAnyway} onClick={() => onRun(false)}>
            {copy.dayOne.leaveIt}
          </Chip>
          <Chip radio selected={runAnyway} onClick={() => onRun(true)}>
            {copy.dayOne.runItAnyway}
          </Chip>
        </div>
      ) : null}
    </article>
  );
}
