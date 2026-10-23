'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Chip } from '../../../components/ui';
import { relearn } from '../../../lib/ai/companion-client';
import { artworkFor } from '../../../lib/art';
import { commonRow, morePlaces, type CommonItem } from '../../../lib/catalog/common';
import { copy } from '../../../lib/copy';
import { groupOf } from '../../../lib/data/routed';
import type { RoutedItem } from '../../../lib/data/types';
import { useRouted } from '../../../lib/data/use-routed';
import { useProgress } from '../../../lib/progress/context';
import { allQuestions, pickQuestion } from '../../../lib/daily';
import { engineApi } from '../../../lib/engine/client';
import { previewRitual } from '../../../lib/engine/preview';
import { useEngine } from '../../../lib/engine/context';
import { ENGINE_CARDS, EngineToday } from './engine-today';
import { track } from '../../../lib/track';
import { newItemId, pictureKindSchema, type Progress } from '../../../lib/progress/types';
import { DStar } from '../../../components/d-star';

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
  standings?: Readonly<Record<string, string>> | null,
): Shelf {
  const status = progress.items.find((i) => i.id === r.stackItemId)?.status ?? 'listed';
  if (status === 'cut') return 'gone';
  if (status === 'kept') return 'kept';
  // The engine's decisions say where each thing stands: signed in from their state, signed out
  // from the same rules run on what the browser holds. The old verdict groups are the fallback.
  const standing = standings?.[r.stackItemId];
  if (standing)
    return standing === 'clinician'
      ? 'protected'
      : standing === 'theirs' || standing === 'keep'
        ? 'kept'
        : standing === 'clear'
          ? 'go'
          : 'call';
  const g = groupOf(r, routed, progress.dayOne);
  if (g === 'protected') return 'protected';
  if (g === 'keep') return 'kept';
  if (g === 'test') return 'reading';
  if (g === 'drop') return 'go';
  return 'call';
}

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
  const { ready, progress, update } = useProgress();
  const { routed } = useRouted();
  const engine = useEngine();
  const live = engine.on ? engine.state : null;
  const [answer, setAnswer] = useState('');
  const [other, setOther] = useState('');
  const [seeAll, setSeeAll] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const todayKey = new Date().toLocaleDateString('en-CA');
  const art = artworkFor(todayKey);

  useEffect(() => track('home_opened'), []);

  // Signed out, the same rules the first Ritual used say where each thing stands.
  const [local, setLocal] = useState<Readonly<Record<string, string>> | null>(null);
  const listKey = ready && !engine.on ? JSON.stringify([progress.items, progress.dayOne.yours]) : '';
  useEffect(() => {
    if (!listKey) return;
    let alive = true;
    previewRitual(progress, Intl.DateTimeFormat().resolvedOptions().timeZone)
      .then((p) => alive && setLocal(p.standings))
      .catch(() => {});
    return () => {
      alive = false;
    };
    // Runs again only when their list changes.
  }, [listKey]);

  useEffect(() => {
    // Signed in, the engine picks today's one thing (below); this rotation is the signed-out demo's.
    if (!ready || engine.on || !routed || progress.daily?.date === todayKey) return;
    update((p) => {
      const next = pickDaily(todayKey, routed, p);
      const asked = next.kind === 'more' ? [...(p.moreAsked ?? []), next.ref ?? ''] : p.moreAsked;
      return { ...p, daily: next, ...(asked ? { moreAsked: asked } : {}) };
    });
  }, [ready, engine.on, routed, progress.daily?.date, todayKey, update]);

  // The engine's pick, when it is one of the home screen's own flows: a place to ask about, or
  // the day's question about who they are.
  const pickKind = live?.today.kind;
  const pickRef = pickKind === 'more' ? live?.today.more : pickKind === 'learn' ? live?.today.learn : undefined;
  useEffect(() => {
    if ((pickKind !== 'more' && pickKind !== 'learn') || !pickRef) return;
    if (progress.daily?.date === todayKey && progress.daily.kind === pickKind) return;
    update((p) => ({
      ...p,
      daily: { date: todayKey, kind: pickKind, ref: pickRef, done: false },
      ...(pickKind === 'more' ? { moreAsked: [...new Set([...(p.moreAsked ?? []), pickRef])] } : {}),
    }));
  }, [pickKind, pickRef, progress.daily?.date, progress.daily?.kind, todayKey, update]);

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
      <section className="d-tab-content d-standard-tab" aria-busy="true">
        <div className="d-painting-block" />
        <div className="d-wait">
          <span className="d-wait__line" />
          <span className="d-wait__line" />
        </div>
      </section>
    );

  const items = progress.items;
  const statusOf = (id: string) => items.find((i) => i.id === id)?.status ?? 'listed';
  const gone = routed.items.filter((r) => statusOf(r.stackItemId) === 'cut');
  const kept = routed.items.filter((r) => statusOf(r.stackItemId) !== 'cut');
  const total = routed.items.reduce((t, r) => t + r.monthlyCost, 0);
  const back = gone.reduce((t, r) => t + r.monthlyCost, 0);
  const standings = live?.items ?? local;
  const shelfOf = (r: RoutedItem) => shelfFor(r, routed, progress, standings);
  const engineCard = !!live && (live.today.kind === null || ENGINE_CARDS.has(live.today.kind));
  const setStatus = (id: string, status: 'cut' | 'kept' | 'listed') =>
    update((p) => ({
      ...p,
      items: p.items.map((i) => (i.id === id ? { ...i, status } : i)),
      daily: p.daily ? { ...p.daily, done: status !== 'listed' } : p.daily,
    }));
  const portrait = portraitOf(progress.lifeText);
  const first = progress.name.trim().split(/\s+/)[0] ?? '';
  // Under their name: what we've learned about them, one line from each part. Until Claude has
  // read them (or if it is off), their ideal day in their own words.
  const pictureLines = progress.picture?.lines ?? [];
  const firsts = pictureKindSchema.options
    .map((kind) => pictureLines.find((l) => l.kind === kind))
    .filter((l): l is NonNullable<typeof l> => !!l);
  const learned = [...firsts, ...pictureLines.filter((l) => !firsts.includes(l))]
    .slice(0, 3)
    .map((l) => l.text);
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

  const lines = learned.length ? (seeAll ? pictureLines.map((l) => l.text) : learned) : portrait;
  const listed = showAll ? routed.items : routed.items.slice(0, 8);
  const badgeOf = (r: RoutedItem): { label: string; tone: string } => {
    const shelf = shelfOf(r);
    if (shelf !== 'gone' && (standings?.[r.stackItemId] === 'theirs' || progress.dayOne.yours.includes(r.stackItemId)))
      return { label: copy.app.standard.yours, tone: 'yours' };
    const tone = shelf === 'kept' ? 'keep' : shelf === 'protected' ? 'yours' : shelf === 'go' || shelf === 'gone' ? 'letgo' : 'call';
    return { label: copy.home.status[shelf], tone };
  };

  return (
    <div className="d-tab-content d-standard-tab">
      {/* One masterpiece a day, captioned like a museum placard. */}
      <figure className="d-painting-block">
        <img
          className="d-painting-img"
          src={art.src}
          alt={`${art.title}, ${art.artist}`}
          style={art.position ? { objectPosition: art.position } : undefined}
        />
        <div className="d-painting-overlay" />
        <figcaption className="d-placard">
          <div className="d-placard__left">
            <p className="d-placard__title">{art.title}</p>
            <p className="d-placard__artist">{art.artist}</p>
            <p className="d-placard__museum">{art.museum}</p>
          </div>
          <div className="d-placard__right">
            <p className="d-placard__year">{art.date}</p>
            <p className="d-placard__medium">{copy.home.todaysWork}</p>
          </div>
        </figcaption>
      </figure>

      <div className="d-standard-body">
        {/* First name only: "Jake Goldsmith" is greeted as Jake. */}
        <h1 className="d-standard-hero">
          {first ? `${first},` : copy.app.standard.you}
          <br />
          <em>{copy.app.standard.atBest}</em>
        </h1>

        <section className="d-standard-section" aria-label={copy.home.todayEyebrow}>
          <h2 className="d-standard-section__label">{copy.app.standard.oneThing}</h2>
          <div className="d-one-thing-card">
            {engineCard && live ? <EngineToday state={live} routed={routed} /> : null}
        {engineCard ? null : !daily ? (
              <h2>{copy.home.nothingTitle}</h2>
            ) : daily.kind === 'more' && place ? (
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
                  <p className="d-one-thing-done">{copy.home.doneToday}</p>
                </>
              ) : (
                <>
                  <h2>{copy.home.more.ask[place.id]}</h2>
                  <p>{copy.home.more.line}</p>
                  <div
                    className="chips d-one-chips"
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
                    className="d-one-other"
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
                    <button type="submit" className="d-one-thing-btn" disabled={!other.trim()}>
                      {copy.home.more.add}
                    </button>
                  </form>
                  <div className="d-one-thing-actions">
                    <button
                      type="button"
                      className="d-one-thing-btn d-one-thing-btn--go"
                      onClick={() => {
                        track('more_done', { place: place.id, added: addedToday.length });
                        update((p) => (p.daily ? { ...p, daily: { ...p.daily, done: true } } : p));
                      }}
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
                  <div className="d-one-thing-actions">
                    <button
                      type="button"
                      className="d-one-thing-btn d-one-thing-btn--go"
                      onClick={() => setStatus(dailyItem.stackItemId, 'cut')}
                    >
                      {copy.home.letGo}
                    </button>
                    <button
                      type="button"
                      className="d-one-thing-btn"
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
                    className="d-see-all"
                    onClick={() => setStatus(dailyStack.id, 'listed')}
                  >
                    {copy.home.undo}
                  </button>
                  <p className="d-one-thing-done">{copy.home.doneToday}</p>
                </>
              )
            ) : daily.kind === 'celebrate' && dailyItem ? (
              <>
                <h2>{copy.home.celebrateTitle(dailyItem.name)}</h2>
                <p>{dailyStack?.essence ?? copy.home.celebrateLine}</p>
                <Link className="d-see-all" href={`/home/ritual/${dailyItem.stackItemId}`}>
                  {copy.home.celebrateNote}
                </Link>
              </>
            ) : daily.done ? (
              daily.learned?.length ? (
                <>
                  <h2>{daily.learned[0]}</h2>
                  <Link className="d-see-all" href="/home/you">
                    {copy.home.learnedLink}
                  </Link>
                  <p className="d-one-thing-done">{copy.home.doneToday}</p>
                </>
              ) : (
                <>
                  <h2>{copy.home.learnThanks}</h2>
                  <p className="d-one-thing-done">{copy.home.doneToday}</p>
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
                <div className="d-one-thing-actions">
                  <button
                    type="button"
                    className="d-one-thing-btn d-one-thing-btn--go"
                    disabled={!answer.trim()}
                    onClick={() => {
                      const ask = { q: daily.ref ?? '', a: answer.trim(), at: new Date().toISOString() };
                      track('answer_given');
                      update((p) => ({
                        ...p,
                        asks: [...p.asks, ask],
                        daily: p.daily ? { ...p.daily, done: true } : p.daily,
                      }));
                      setAnswer('');
                      // Signed in, the engine learns from it too (who they are, and anything it changes).
                      if (engine.on) void engine.act(() => engineApi.run({ kind: 'answer', q: ask.q, a: ask.a }));
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
          </div>
        </section>

        {lines.length ? (
          <section className="d-standard-section" aria-label={learned.length ? copy.you.link : copy.home.idealDay}>
            <h2 className="d-standard-section__label">{learned.length ? copy.app.standard.learned : copy.home.idealDay}</h2>
            <ul className="d-learned-lines">
              {lines.map((line) => (
                <li key={line} className="d-learned-line">
                  <DStar size="tiny" />
                  <p>“{line.replace(/[.]$/, '')}.”</p>
                </li>
              ))}
            </ul>
            {learned.length ? (
              <div className="d-standard-links">
                {pictureLines.length > learned.length ? (
                  <button type="button" className="d-see-all" aria-expanded={seeAll} onClick={() => setSeeAll((v) => !v)}>
                    {seeAll ? copy.app.standard.showLess : copy.app.standard.seeAll} →
                  </button>
                ) : null}
                {seeAll || pictureLines.length <= learned.length ? (
                  <Link className="d-see-all d-see-all--quiet" href="/home/you">
                    {copy.app.standard.change} →
                  </Link>
                ) : null}
              </div>
            ) : null}
          </section>
        ) : null}

        <section className="d-standard-section" aria-label={copy.home.ritualsEyebrow}>
          <div className="d-everything-header">
            <h2 className="d-standard-section__label">{copy.app.standard.everything}</h2>
            <span className="d-everything-meta">{copy.app.standard.meta(kept.length, money(total - back))}</span>
          </div>
          <ul className="d-everything-list">
            {listed.map((r) => {
              const badge = badgeOf(r);
              const gone = shelfOf(r) === 'gone';
              return (
                <li key={r.stackItemId}>
                  <Link className={`d-e-item${gone ? ' d-e-item--letgo' : ''}`} href={`/home/ritual/${r.stackItemId}`}>
                    <span className="d-e-item__name">{r.name}</span>
                    <span className="d-e-item__right">
                      {r.monthlyCost > 0 ? <span className="d-e-item__cost">${money(r.monthlyCost)}</span> : null}
                      <span className={`d-e-badge d-e-badge--${badge.tone}`}>{badge.label}</span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
          {routed.items.length > 8 ? (
            <button type="button" className="d-see-all" aria-expanded={showAll} onClick={() => setShowAll((v) => !v)}>
              {showAll ? copy.app.standard.showLess : copy.app.standard.more(routed.items.length - 8)} →
            </button>
          ) : null}
          {back > 0 ? <p className="d-money-back">{copy.app.standard.moneyBack(money(back))}</p> : null}
        </section>

        <section className="d-standard-section" aria-label={copy.home.noticingEyebrow}>
          <h2 className="d-standard-section__label">{copy.home.noticingEyebrow}</h2>
          <div className="d-next-card">
            <p className="d-next-card__intro d-noticing">
              {progress.dataSource ? copy.home.noticingEmpty : copy.home.noticingConnect}
            </p>
            {progress.dataSource ? null : (
              <Link className="d-see-all" href="/connect">
                {copy.home.connect} →
              </Link>
            )}
          </div>
        </section>

        <section className="d-standard-section d-standard-section--next" aria-label={copy.app.standard.next}>
          <h2 className="d-standard-section__label">{copy.app.standard.next}</h2>
          <div className="d-next-card">
            <p className="d-next-card__intro">{copy.app.standard.nextIntro}</p>
            <div className="d-next-card__teaser">
              <DStar size="small" />
              <p>
                {copy.app.standard.nextTeaser}
                <br />
                <em>{copy.app.standard.soon}</em>
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
