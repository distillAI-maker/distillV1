'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Chip, Skeleton } from '../../../components/ui';
import { relearn } from '../../../lib/ai/companion-client';
import { thoughtForYou } from '../../../lib/ai/distill-action';
import { kindOf, personOf } from '../../../lib/ai/person';
import { artworkFor } from '../../../lib/art';
import { thoughtFor } from '../../../lib/wisdom';
import { commonRow, morePlaces, type CommonItem } from '../../../lib/catalog/common';
import { copy } from '../../../lib/copy';
import { groupOf } from '../../../lib/data/routed';
import type { RoutedItem } from '../../../lib/data/types';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';
import { newItemId, pictureKindSchema, type Progress } from '../../../lib/progress/types';
import s from './home.module.css';

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
type Daily = NonNullable<Progress['daily']>;

function shelfFor(
  r: RoutedItem,
  routed: NonNullable<ReturnType<typeof useRouted>['routed']>,
  progress: Progress,
): Shelf {
  const status = progress.items.find((i) => i.id === r.stackItemId)?.status ?? 'listed';
  if (status === 'cut') return 'gone';
  if (status === 'kept') return 'kept';
  const g = groupOf(r, routed, progress.dayOne);
  if (g === 'protected') return 'protected';
  if (g === 'keep') return 'kept';
  if (g === 'test') return 'reading';
  if (g === 'drop') return 'go';
  return 'call';
}

/**
 * The day's question: one not asked before, about the part of "What we've learned about you" we
 * know least, so each answer fills in the picture. Once all are asked, they come round again.
 */
export function pickQuestion(day: number, progress: Progress): string {
  const kinds = pictureKindSchema.options;
  const lines = progress.picture?.lines ?? [];
  const known = (k: string) => lines.filter((l) => l.kind === k).length;
  const turn = (k: string) => (kinds.indexOf(k as (typeof kinds)[number]) + day) % kinds.length;
  const asked = new Set(progress.asks.map((a) => a.q));
  for (const kind of [...kinds].sort((a, b) => known(a) - known(b) || turn(a) - turn(b))) {
    const next = (copy.home.questions[kind] as readonly Question[]).find((x) => !asked.has(x.q));
    if (next) return next.q;
  }
  const all = allQuestions();
  return (all[day % all.length] as Question).q;
}

type Question = { q: string; eg: string };
const allQuestions = (): readonly Question[] =>
  pictureKindSchema.options.flatMap((k): readonly Question[] => copy.home.questions[k]);

/** The example answer shown in the box for a question. */
function exampleFor(q: string | undefined): string {
  return allQuestions().find((x) => x.q === q)?.eg ?? copy.home.learnPlaceholder;
}

/**
 * Today's one thing, chosen once a day and kept for the day: something to let go of, one question
 * about them, or a ritual of theirs to celebrate, in rotation, skipping what doesn't apply. Every
 * other day, until each place has been asked about once, it is "Anything we haven't seen?" so the
 * stack they first listed grows into the one they really have.
 */
export function pickDaily(
  date: string,
  routed: NonNullable<ReturnType<typeof useRouted>['routed']>,
  progress: Progress,
): Daily {
  const day = Math.floor(Date.parse(`${date}T12:00:00Z`) / 86_400_000);
  const asked = new Set(progress.moreAsked ?? []);
  const place = morePlaces.find((p) => !asked.has(p.id));
  if (place && day % 2 === 0) return { date, kind: 'more', ref: place.id, done: false };
  const statusOf = (id: string) => progress.items.find((i) => i.id === id)?.status ?? 'listed';
  const letgo = routed.items.find(
    (r) => statusOf(r.stackItemId) === 'listed' && shelfFor(r, routed, progress) === 'go',
  );
  const theirs = routed.items.filter((r) => shelfFor(r, routed, progress) === 'kept');
  const order: Daily['kind'][] = ['letgo', 'learn', 'celebrate'];
  for (let k = 0; k < order.length; k++) {
    const kind = order[(day + k) % order.length] as Daily['kind'];
    if (kind === 'letgo' && letgo) return { date, kind, ref: letgo.stackItemId, done: false };
    if (kind === 'celebrate' && theirs.length) {
      const pick = theirs[day % theirs.length] as RoutedItem;
      return { date, kind, ref: pick.stackItemId, done: false };
    }
    if (kind === 'learn') return { date, kind, ref: pickQuestion(day, progress), done: false };
  }
  return { date, kind: 'learn', ref: pickQuestion(day, progress), done: false };
}

/**
 * Home: Your Standard. Today's masterpiece, who they are at their best in their own words, what their
 * stack is, one thing for today, what we're noticing, and their rituals, each one theirs to open.
 */
export function StandardHome() {
  const { progress, update } = useProgress();
  const { routed } = useRouted();
  const [answer, setAnswer] = useState('');
  const [other, setOther] = useState('');
  const [thinking, setThinking] = useState(false);

  /** Opens today's thought; the first time each day, Claude writes how it touches their life. */
  function toggleThought() {
    const opening = !thinking;
    setThinking(opening);
    if (!opening || !routed || progress.thought?.date === todayKey) return;
    const { saying } = thoughtFor(todayKey, progress.picture);
    void thoughtForYou({ person: personOf(progress, routed), saying }).then((result) => {
      if (result.status === 'ok' || result.status === 'none')
        update((p) => ({
          ...p,
          thought: { date: todayKey, line: result.status === 'ok' ? result.line : '' },
        }));
    });
  }
  const todayKey = new Date().toLocaleDateString('en-CA');
  const art = artworkFor(todayKey);
  const thought = thoughtFor(todayKey, progress.picture);
  const forYou = progress.thought?.date === todayKey ? progress.thought.line : '';

  useEffect(() => {
    if (!routed || progress.daily?.date === todayKey) return;
    update((p) => {
      const next = pickDaily(todayKey, routed, p);
      const asked = next.kind === 'more' ? [...(p.moreAsked ?? []), next.ref ?? ''] : p.moreAsked;
      return { ...p, daily: next, ...(asked ? { moreAsked: asked } : {}) };
    });
  }, [routed, progress.daily?.date, todayKey, update]);

  // The first time home opens, we read what they have shared so far (their ideal day, any notes)
  // and start "What we've learned about you". Once only; after that, notes and answers update it.
  const hasPicture = !!progress.picture;
  useEffect(() => {
    if (!routed || hasPicture) return;
    const shared =
      progress.lifeText.trim() || progress.asks.length || progress.items.some((i) => i.notes.length);
    if (!shared) return;
    const empty = { lines: [], removed: [], updatedAt: new Date().toISOString() };
    update((p) => (p.picture ? p : { ...p, picture: empty }));
    void relearn({ ...progress, picture: empty }, routed, update);
    // Runs once per person: `hasPicture` turns true straight away.
  }, [routed, hasPicture]);

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
  const shelfOf = (r: RoutedItem) => shelfFor(r, routed, progress);
  const setStatus = (id: string, status: 'cut' | 'kept' | 'listed') =>
    update((p) => ({
      ...p,
      items: p.items.map((i) => (i.id === id ? { ...i, status } : i)),
      daily: p.daily ? { ...p.daily, done: status !== 'listed' } : p.daily,
    }));
  const portrait = portraitOf(progress.lifeText);
  // Under their name: what we've learned about them, one line from each part. Until Claude has
  // read them (or if it is off), their ideal day in their own words.
  const pictureLines = progress.picture?.lines ?? [];
  const firsts = pictureKindSchema.options
    .map((kind) => pictureLines.find((l) => l.kind === kind))
    .filter((l): l is NonNullable<typeof l> => !!l);
  const learned = [...firsts, ...pictureLines.filter((l) => !firsts.includes(l))]
    .slice(0, 3)
    .map((l) => l.text);
  const about = learned.length ? learned : portrait;
  const reasonOf = (r: RoutedItem) =>
    r.landing.reason ? copy.dayOne.reasons[r.landing.reason] : null;
  const daily = progress.daily?.date === todayKey ? progress.daily : undefined;
  const dailyItem =
    daily?.kind !== 'learn' ? routed.items.find((r) => r.stackItemId === daily?.ref) : undefined;
  const dailyStack = dailyItem ? items.find((i) => i.id === dailyItem.stackItemId) : undefined;

  // "Anything we haven't seen?": the place's chips they don't have yet, and what they added today.
  const place = daily?.kind === 'more' ? morePlaces.find((p) => p.id === daily.ref) : undefined;
  const addedToday = daily?.added ?? [];
  const inStack = new Set(items.map((i) => i.itemKey));
  const placeChips = place
    ? place.items.filter((i) => !inStack.has(i.key) || addedToday.includes(i.key))
    : [];
  const ownToday = items.filter((i) => addedToday.includes(`id:${i.id}`));
  const setAdded = (p: Progress, added: string[]): Progress =>
    p.daily ? { ...p, daily: { ...p.daily, added } } : p;
  function toggleMore(item: CommonItem) {
    update((p) => {
      const added = p.daily?.added ?? [];
      const there = p.items.find((i) => i.itemKey === item.key);
      if (there && added.includes(item.key))
        return setAdded(
          { ...p, items: p.items.filter((i) => i.id !== there.id) },
          added.filter((k) => k !== item.key),
        );
      if (there) return p;
      return setAdded({ ...p, items: [...p.items, commonRow(item, p.items.length)] }, [
        ...added,
        item.key,
      ]);
    });
  }
  function addOther() {
    const name = other.trim().slice(0, 120);
    if (!name) return;
    const id = newItemId();
    update((p) =>
      setAdded(
        {
          ...p,
          items: [
            ...p.items,
            {
              id,
              itemKey: null,
              customName: name,
              monthlyCost: 0,
              answers: {},
              chips: {},
              unknown: [],
              status: 'listed',
              notes: [],
              position: p.items.length,
            },
          ],
        },
        [...(p.daily?.added ?? []), `id:${id}`],
      ),
    );
    setOther('');
  }
  function removeOwn(id: string) {
    update((p) =>
      setAdded(
        { ...p, items: p.items.filter((i) => i.id !== id) },
        (p.daily?.added ?? []).filter((k) => k !== `id:${id}`),
      ),
    );
  }

  return (
    <div className={s.page}>
      {/* One masterpiece a day, captioned like a placard. Behind it, today's thought: a line from
          the ancients about a part of who they are, beside one of their own lines. */}
      <figure className={s.plate}>
        <button
          type="button"
          className={`${s.frame} ${thinking ? s.open : ''}`}
          aria-expanded={thinking}
          aria-label={thinking ? copy.home.thoughtClose : copy.home.thoughtOpen}
          onClick={toggleThought}
        >
          <img
            className={s.painting}
            src={art.src}
            alt={`${art.title}, ${art.artist}`}
            style={art.position ? { objectPosition: art.position } : undefined}
          />
          <span className={`${s.thought} ${thinking ? s.thoughtOn : ''}`} aria-hidden={!thinking}>
            <q>{thought.saying.text}</q>
            <cite>{thought.saying.who}</cite>
            <span className={s.plain}>{thought.saying.plain}</span>
            {forYou ? (
              <span className={s.mine}>
                <b>{copy.home.forYou}</b> {forYou}
              </span>
            ) : null}
          </span>
        </button>
        <figcaption className={s.placard}>
          <span>
            <em>{art.title}</em> {art.artist}, {art.date}. {art.museum}.
          </span>
          <button type="button" className={s.thoughtLink} onClick={toggleThought}>
            {thinking ? copy.home.thoughtClose : copy.home.thought}
          </button>
        </figcaption>
      </figure>

      {/* First name only: "Jake Goldsmith" is greeted as Jake. */}
      <h1 className={s.title}>{copy.home.title(progress.name.trim().split(/\s+/)[0] ?? '')}</h1>
      {about.length ? (
        <section aria-label={learned.length ? copy.you.link : copy.home.idealDay}>
          <p className={s.eyebrow}>{learned.length ? copy.you.link : copy.home.idealDay}</p>
          <ul className={s.portrait}>
            {about.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          {learned.length ? (
            <Link className={s.link} href="/home/you">
              {copy.home.seeAll} →
            </Link>
          ) : null}
        </section>
      ) : null}

      <section className={s.standard} aria-label={copy.home.stack}>
        <p className={s.eyebrow}>{copy.home.stack}</p>
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

      <section className={`${s.today} ${s.learn}`} aria-label={copy.home.todayEyebrow}>
        <p className={s.eyebrow}>{copy.home.todayEyebrow}</p>
        {!daily ? null : daily.kind === 'more' && place ? (
          daily.done ? (
            <>
              <h2>
                {addedToday.length
                  ? copy.home.more.added(
                      addedToday.length,
                      items.filter((i) => i.status !== 'cut').length,
                    )
                  : copy.home.more.none}
              </h2>
              <p className={s.done}>{copy.home.doneToday}</p>
            </>
          ) : (
            <>
              <h2>{copy.home.more.ask[place.id]}</h2>
              <p>{copy.home.more.line}</p>
              <div
                className={`chips ${s.moreChips}`}
                role="group"
                aria-label={copy.home.more.ask[place.id]}
              >
                {placeChips.map((item) => (
                  <Chip
                    key={item.key}
                    selected={addedToday.includes(item.key)}
                    onClick={() => toggleMore(item)}
                  >
                    {item.text}
                  </Chip>
                ))}
                {ownToday.map((i) => (
                  <Chip key={i.id} selected onClick={() => removeOwn(i.id)}>
                    {i.customName}
                  </Chip>
                ))}
              </div>
              <form
                className={s.other}
                onSubmit={(e) => {
                  e.preventDefault();
                  addOther();
                }}
              >
                <input
                  aria-label={copy.home.more.otherLabel}
                  placeholder={copy.home.more.other}
                  maxLength={120}
                  value={other}
                  onChange={(e) => setOther(e.target.value)}
                />
                <button type="submit" className={s.secondary} disabled={!other.trim()}>
                  {copy.home.more.add}
                </button>
              </form>
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.primary}
                  onClick={() =>
                    update((p) => (p.daily ? { ...p, daily: { ...p.daily, done: true } } : p))
                  }
                >
                  {copy.home.more.done}
                </button>
              </div>
            </>
          )
        ) : daily.kind === 'letgo' && dailyItem && dailyStack ? (
          dailyStack.status === 'listed' ? (
            <>
              <h2>{dailyItem.name}</h2>
              <p>
                {[reasonOf(dailyItem), copy.dayOne.perMonth(money(dailyItem.monthlyCost))]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <div className={s.actions}>
                <button
                  type="button"
                  className={s.primary}
                  onClick={() => setStatus(dailyItem.stackItemId, 'cut')}
                >
                  {copy.home.letGo}
                </button>
                <button
                  type="button"
                  className={s.secondary}
                  onClick={() => setStatus(dailyItem.stackItemId, 'kept')}
                >
                  {copy.home.keep}
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>{dailyStack.status === 'cut' ? copy.home.letGoneTitle : copy.home.keptTitle}</h2>
              <p>
                {dailyStack.status === 'cut'
                  ? copy.home.letGoneLine(money(dailyStack.monthlyCost))
                  : copy.home.keptLine}
              </p>
              <button
                type="button"
                className={s.link}
                onClick={() => setStatus(dailyStack.id, 'listed')}
              >
                {copy.home.undo}
              </button>
              <p className={s.done}>{copy.home.doneToday}</p>
            </>
          )
        ) : daily.kind === 'celebrate' && dailyItem ? (
          <>
            <h2>{copy.home.celebrateTitle(dailyItem.name)}</h2>
            <p>{dailyStack?.essence ?? copy.home.celebrateLine}</p>
            <Link className={s.link} href={`/home/ritual/${dailyItem.stackItemId}`}>
              {copy.home.celebrateNote}
            </Link>
          </>
        ) : daily.done ? (
          daily.learned?.length ? (
            <>
              <h2>{daily.learned[0]}</h2>
              <Link className={s.link} href="/home/you">
                {copy.home.learnedLink}
              </Link>
              <p className={s.done}>{copy.home.doneToday}</p>
            </>
          ) : (
            <>
              <h2>{copy.home.learnThanks}</h2>
              <p className={s.done}>{copy.home.doneToday}</p>
            </>
          )
        ) : (
          <>
            <h2>{daily.ref}</h2>
            <textarea
              aria-label={daily.ref}
              rows={3}
              maxLength={2000}
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder={exampleFor(daily.ref)}
            />
            <div className={s.actions}>
              <button
                type="button"
                className={s.primary}
                disabled={!answer.trim()}
                onClick={() => {
                  const ask = { q: daily.ref ?? '', a: answer.trim(), at: new Date().toISOString() };
                  update((p) => ({
                    ...p,
                    asks: [...p.asks, ask],
                    daily: p.daily ? { ...p.daily, done: true } : p.daily,
                  }));
                  setAnswer('');
                  // Show back what this answer added to the picture, once Claude has read it.
                  void relearn({ ...progress, asks: [...progress.asks, ask] }, routed, update).then(
                    (newest) => {
                      if (!newest) return;
                      update((p) =>
                        p.daily?.date === daily.date
                          ? { ...p, daily: { ...p.daily, learned: [newest] } }
                          : p,
                      );
                    },
                  );
                }}
              >
                {copy.home.learnSave}
              </button>
            </div>
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
                <Link className={s.placardLink} href={`/home/ritual/${r.stackItemId}`}>
                  <span className={s.status}>{copy.home.status[shelf]}</span>
                  <span className={s.pname}>{r.name}</span>
                  <span className={s.pmeta}>
                    {[kindOf(r, progress), origin ? copy.home.fromOrigin(origin) : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                  <span className={s.pcost}>
                    {shelf === 'gone'
                      ? copy.home.costBack(money(r.monthlyCost))
                      : copy.dayOne.perMonth(money(r.monthlyCost))}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className={s.soon} aria-label={copy.home.soonTitle}>
        <h2>{copy.home.soonTitle}</h2>
        <p>{copy.home.soonLine}</p>
      </section>
    </div>
  );
}
