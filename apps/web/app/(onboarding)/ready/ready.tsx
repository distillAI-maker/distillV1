'use client';

import { useGo } from '../../../components/onboarding/go';
import { sentenceOf } from '../../../components/onboarding/groups';
import { Icon } from '../../../components/icon';
import { Button, Chip, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { groupOf } from '../../../lib/data/routed';
import type { RoutedItem } from '../../../lib/data/types';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * What can go today, settled without a test. The first reason reads in full; the rest are a
 * private reading until the person joins as a founding member (free while we build it).
 */
export function Ready() {
  const go = useGo();
  const { progress, update } = useProgress();
  const { routed, summary, failed, retry } = useRouted();
  const dayOne = progress.dayOne;
  const setDayOne = (patch: Partial<typeof dayOne>) =>
    update((p) => ({ ...p, dayOne: { ...p.dayOne, ...patch } }));

  if (failed)
    return (
      <section className="stack">
        <p className="notice" role="alert">
          {copy.dayOne.error}
        </p>
        <div className="actions-row">
          <Button onClick={retry}>{copy.common.tryAgain}</Button>
        </div>
      </section>
    );
  if (!routed || !summary)
    return (
      <section className="stack" aria-busy="true">
        <Skeleton kind="title" count={2} />
        <Skeleton kind="option" count={3} />
      </section>
    );

  // Everything the engine settled today, kept-anyway items included so they can be switched back.
  const inPair = new Set(routed.overlaps.flatMap((o) => o.keys));
  const settled: RoutedItem[] = routed.items.filter((r) => {
    if (r.itemKey && inPair.has(r.itemKey)) return false;
    const g = groupOf(r, routed, dayOne);
    return g === 'drop' || (r.landing.tier === 'T2' && dayOne.keepAnyway.includes(r.stackItemId));
  });
  const going = settled.filter((r) => groupOf(r, routed, dayOne) === 'drop');
  const member = progress.member;

  return (
    <section className="stack screen-ready">
      <h1>{copy.ready.title(summary.dropsToday)}</h1>
      {summary.dropsToday === 0 && routed.overlaps.length === 0 ? (
        <p className="lede">{copy.ready.noneLine}</p>
      ) : null}

      {routed.overlaps.map((pair) => {
        const kept =
          dayOne.overlapChoices[pair.group] ?? pair.keys.find((k) => k !== pair.suggestedDrop);
        const nameOf = (k: string) => routed.items.find((r) => r.itemKey === k)?.name ?? k;
        const costOf = (k: string) => routed.items.find((r) => r.itemKey === k)?.monthlyCost ?? 0;
        return (
          <div
            key={pair.group}
            className="pair-card"
            role="group"
            aria-label={copy.dayOne.overlapTitle}
          >
            <h2 className="h-small">{copy.dayOne.overlapTitle}</h2>
            <p className="muted">{copy.dayOne.overlapLine}</p>
            <div className="pair-two">
              {pair.keys.map((k) => (
                <div key={k}>
                  <span className="pair-name">{nameOf(k)}</span>
                  <span className="pair-facts num">
                    {[pair.facts[k], copy.dayOne.perMonth(money(costOf(k)))]
                      .filter(Boolean)
                      .join(' · ')}
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
                  onClick={() =>
                    setDayOne({ overlapChoices: { ...dayOne.overlapChoices, [pair.group]: k } })
                  }
                >
                  {copy.dayOne.keepThis(nameOf(k))}
                </Chip>
              ))}
            </div>
          </div>
        );
      })}

      {settled.length ? (
        <ol className="release">
          {settled.map((r, i) => {
            const open = member || i === 0;
            const keepAnyway = dayOne.keepAnyway.includes(r.stackItemId);
            const reason = r.landing.reason ? copy.dayOne.reasons[r.landing.reason] : null;
            return (
              <li key={r.stackItemId} className={keepAnyway ? 'kept' : undefined}>
                <span className="release-n num">{String(i + 1).padStart(2, '0')}</span>
                <div className="release-main">
                  <div className="release-title">
                    <span>{r.name}</span>
                    <b className="num">{copy.dayOne.perMonth(money(r.monthlyCost))}</b>
                  </div>
                  {reason ? <span className="release-reason">{reason}</span> : null}
                  {open ? (
                    <>
                      <p className="release-say">{sentenceOf(r, 'drop')}</p>
                      <div className="switch" role="radiogroup" aria-label={r.name}>
                        <Chip
                          radio
                          selected={!keepAnyway}
                          onClick={() =>
                            setDayOne({
                              keepAnyway: dayOne.keepAnyway.filter((x) => x !== r.stackItemId),
                            })
                          }
                        >
                          {copy.dayOne.letItGo}
                        </Chip>
                        <Chip
                          radio
                          selected={keepAnyway}
                          onClick={() =>
                            setDayOne({
                              keepAnyway: [...new Set([...dayOne.keepAnyway, r.stackItemId])],
                            })
                          }
                        >
                          {copy.dayOne.keepItAnyway}
                        </Chip>
                      </div>
                    </>
                  ) : (
                    <div className="locked">
                      <p aria-hidden="true">{sentenceOf(r, 'drop')}</p>
                      <span>{copy.ready.privateReading}</span>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}

      {going.length || summary.monthlyBack ? (
        <div className="saving">
          <strong>${money(summary.monthlyBack)}</strong>
          <p>{copy.ready.aMonthBack}</p>
        </div>
      ) : null}

      <div className="actions">
        <Button onClick={() => go(member ? 'connect' : 'invitation')}>
          {member ? copy.ready.memberNext : copy.ready.next}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}
