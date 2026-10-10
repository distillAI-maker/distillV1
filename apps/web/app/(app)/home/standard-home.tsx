'use client';

import Link from 'next/link';
import { Skeleton } from '../../../components/ui';
import { shortName } from '../../../lib/catalog/short-names';
import { copy } from '../../../lib/copy';
import { groupOf } from '../../../lib/data/routed';
import type { RoutedItem } from '../../../lib/data/types';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';
import s from './home.module.css';

/** CC0, The Metropolitan Museum of Art open access, via Wikimedia Commons. */
const plate =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Lake_George_MET_DT84.jpg/1280px-Lake_George_MET_DT84.jpg';

const money = (n: number) => Math.round(n).toLocaleString('en-US');

/** "A good morning, for me, looks like ..." : the lead-in before the list of what a good day holds. */
const leadIn =
  /^(?:(?:a|my|the)\s+(?:good|ideal|perfect|great|best)\s+(?:morning|day|week)|(?:my\s+)?ideal\s+day)(?:,?\s*for me,?)?\s+(?:looks like|is|starts with|means|would be|has)\s+/i;
/** Sentences about what gets in the way are theirs to say, not ours to show back as a portrait. */
const notPortrait = /^(?:what|but|however|the problem|the thing)\b|gets? in the way/i;

/** Up to three short lines from what they wrote about their ideal day, in their own words. */
export function portraitOf(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence && !notPortrait.test(sentence))
    .flatMap((sentence) => {
      const body = sentence.replace(leadIn, '').replace(/[.!?]+$/, '');
      return body.length > 70 || body !== sentence.replace(/[.!?]+$/, '')
        ? body.split(/,\s*(?:and\s+)?|\s+and\s+/)
        : [body];
    })
    .map((p) => p.trim())
    .filter((p) => p.length >= 8 && p.length <= 70)
    .slice(0, 3)
    .map((p) => `${p.charAt(0).toUpperCase()}${p.slice(1)}.`);
}

type Shelf = keyof typeof copy.home.status;

/**
 * Home: Your Standard. Who they are at their best in their own words, what their stack is down to,
 * one thing for today, what we're noticing, and their rituals. The engine decides; this only says.
 */
export function StandardHome() {
  const { progress, update } = useProgress();
  const { routed } = useRouted();
  if (!routed)
    return (
      <section className={s.page} aria-busy="true">
        <Skeleton kind="title" count={2} />
      </section>
    );

  const items = progress.items;
  const statusOf = (id: string) => items.find((i) => i.id === id)?.status ?? 'listed';
  const gone = routed.items.filter((r) => statusOf(r.stackItemId) === 'cut');
  const kept = routed.items.filter((r) => statusOf(r.stackItemId) !== 'cut');
  const total = routed.items.reduce((t, r) => t + r.monthlyCost, 0);
  const back = gone.reduce((t, r) => t + r.monthlyCost, 0);
  const shelfOf = (r: RoutedItem): Shelf => {
    const status = statusOf(r.stackItemId);
    if (status === 'cut') return 'gone';
    if (status === 'kept') return 'kept';
    const g = groupOf(r, routed, progress.dayOne);
    return g === 'protected'
      ? 'protected'
      : g === 'keep'
        ? 'kept'
        : g === 'test'
          ? 'reading'
          : g === 'drop'
            ? 'go'
            : 'call';
  };
  // Today: the first thing the engine settled that they haven't decided on yet.
  const today = routed.items.find(
    (r) => statusOf(r.stackItemId) === 'listed' && shelfOf(r) === 'go',
  );
  const lastDecision = [...items].reverse().find((i) => i.status === 'cut' || i.status === 'kept');
  const setStatus = (id: string, status: 'cut' | 'kept' | 'listed') =>
    update((p) => ({ ...p, items: p.items.map((i) => (i.id === id ? { ...i, status } : i)) }));
  const portrait = portraitOf(progress.lifeText);
  const reasonOf = (r: RoutedItem) =>
    r.landing.reason ? copy.dayOne.reasons[r.landing.reason] : null;
  // What it is, under their own word for it: "Barry's" reads "Boutique classes".
  const kindOf = (r: RoutedItem) => {
    const own = items.find((i) => i.id === r.stackItemId)?.label;
    const kind = own && r.itemKey ? shortName(r.itemKey, '') : '';
    return kind || copy.stack.categories[r.category as keyof typeof copy.stack.categories];
  };

  return (
    <div className={s.page}>
      <figure className={s.plate}>
        <img src={plate} alt={copy.home.plateAlt} />
        <figcaption>{copy.home.plate}</figcaption>
      </figure>

      <p className={s.eyebrow}>{copy.home.eyebrow}</p>
      <h1 className={s.title}>{copy.home.title(progress.name.trim())}</h1>
      {portrait.length ? (
        <>
          <ul className={s.portrait} aria-label={copy.home.inYourWords}>
            {portrait.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <p className={s.caption}>{copy.home.inYourWords}</p>
        </>
      ) : (
        <Link className={s.link} href="/life">
          {copy.home.noWords}
        </Link>
      )}

      <section className={s.standard} aria-label={copy.home.eyebrow}>
        <div className={s.figures}>
          <div>
            <strong>{kept.length}</strong>
            <span>
              {copy.home.things(kept.length)}
              {gone.length ? `, ${copy.home.from(routed.items.length)}` : ''}
            </span>
          </div>
          <div>
            <strong>${money(total - back)}</strong>
            <span>{gone.length ? copy.home.aMonthFrom(money(total)) : copy.home.aMonth}</span>
          </div>
        </div>
        {back > 0 ? <p className={s.back}>{copy.home.back(money(back))}</p> : null}
      </section>

      <section className={s.today} aria-label={copy.home.todayEyebrow}>
        <p className={s.eyebrow}>{copy.home.todayEyebrow}</p>
        {today ? (
          <>
            <h2>{today.name}</h2>
            <p>
              {[reasonOf(today), copy.dayOne.perMonth(money(today.monthlyCost))]
                .filter(Boolean)
                .join(' · ')}
            </p>
            <div className={s.actions}>
              <button
                type="button"
                className={s.primary}
                onClick={() => setStatus(today.stackItemId, 'cut')}
              >
                {copy.home.letGo}
              </button>
              <button
                type="button"
                className={s.secondary}
                onClick={() => setStatus(today.stackItemId, 'kept')}
              >
                {copy.home.keep}
              </button>
            </div>
          </>
        ) : lastDecision ? (
          <>
            <h2>{lastDecision.status === 'cut' ? copy.home.letGoneTitle : copy.home.keptTitle}</h2>
            <p>
              {lastDecision.status === 'cut'
                ? copy.home.letGoneLine(money(lastDecision.monthlyCost))
                : copy.home.keptLine}
            </p>
            <button
              type="button"
              className={s.link}
              onClick={() => setStatus(lastDecision.id, 'listed')}
            >
              {copy.home.undo}
            </button>
          </>
        ) : (
          <>
            <h2>{copy.home.nothingTitle}</h2>
            <p>{copy.home.nothingLine}</p>
          </>
        )}
      </section>

      <section className={s.noticing} aria-label={copy.home.noticingEyebrow}>
        <p className={s.eyebrow}>{copy.home.noticingEyebrow}</p>
        <article>
          <p>{progress.dataSource ? copy.home.noticingEmpty : copy.home.noticingConnect}</p>
          {progress.dataSource ? null : (
            <Link className={s.link} href="/connect">
              {copy.home.connect}
            </Link>
          )}
        </article>
      </section>

      <section aria-label={copy.home.ritualsEyebrow}>
        <div className={s.sectionHead}>
          <p className={s.eyebrow}>{copy.home.ritualsEyebrow}</p>
          {routed.items.length > 6 ? (
            <Link className={s.all} href="/file">
              {copy.home.all(routed.items.length)}
            </Link>
          ) : null}
        </div>
        <ul className={s.placards}>
          {routed.items.slice(0, 6).map((r) => {
            const shelf = shelfOf(r);
            const origin = r.origin ? copy.home.origins[r.origin] : undefined;
            return (
              <li key={r.stackItemId} className={shelf === 'gone' ? s.gone : undefined}>
                <span className={s.status}>{copy.home.status[shelf]}</span>
                <span className={s.pname}>{r.name}</span>
                <span className={s.pmeta}>
                  {[kindOf(r), origin ? copy.home.fromOrigin(origin) : null]
                    .filter(Boolean)
                    .join(' · ')}
                </span>
                <span className={s.pcost}>
                  {shelf === 'gone'
                    ? copy.home.costBack(money(r.monthlyCost))
                    : copy.dayOne.perMonth(money(r.monthlyCost))}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={s.soon} aria-label={copy.home.soonTitle}>
        <p className={s.eyebrow}>{copy.home.soonEyebrow}</p>
        <h2>{copy.home.soonTitle}</h2>
        <p>{copy.home.soonLine}</p>
      </section>

      <p className={s.closing}>{copy.home.closing}</p>
    </div>
  );
}
