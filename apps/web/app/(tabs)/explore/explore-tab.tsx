'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Arrow, Mark } from '../../../components/ds/ui';
import { copy } from '../../../lib/copy';
import { track } from '../../../lib/track';
import { engineApi, type EngineState } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { nearbyFor } from '../../../lib/explore/nearby';
import { leadUrl, threadsFor } from '../../../lib/explore/threads';
import { useProgress } from '../../../lib/progress/context';
import { longDate } from '../../../lib/ritual-view';
import { useStandings } from '../things/things-tab';

const t = copy.exploreTab;
type Found = EngineState['explore']['events'][number];
/** What a card needs, whether the weekly search found it or it's a place from the bank. */
interface Card {
  readonly id: string;
  readonly thread: string;
  readonly title: string;
  readonly date?: string;
  readonly when?: string;
  readonly where?: string;
  readonly url: string;
  readonly why?: string;
  readonly past?: boolean;
}

/** The search underway, kept across visits to this tab: coming back picks it up instead of starting another. */
let underway: { region: string; result: Promise<EngineState['explore'] | null> } | null = null;

/** "In 19 weeks", from today to a date. */
function countdown(date: string, today: string): string {
  const days = Math.round((Date.parse(`${date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86_400_000);
  if (days <= 0) return t.today;
  if (days === 1) return t.tomorrow;
  if (days < 14) return t.inDays(days);
  if (days < 70) return t.inWeeksCount(Math.round(days / 7));
  return t.inMonths(Math.round(days / 30));
}

const whenOf = (e: Card, today: string | null) =>
  e.date ? `${longDate(e.date)}${today ? ` · ${countdown(e.date, today)}` : ''}` : (e.when ?? '');

/**
 * Explore: never a new habit, always a next step for something they already do. Running opens a race
 * near them; a sauna, a bathhouse worth the trip. Three layers, so there is something real from the
 * first moment and something new every week:
 * - places near them from the bank of checked ideas (lib/explore/nearby.ts), signed in or not;
 * - signed in, real dated events found once a week (lib/ai/engine/explore-feed.ts);
 * - next steps with a live search for their city (lib/explore/threads.ts), wherever they live.
 * What they say yes to goes on their Ritual and counts down, and afterward it asks how it was.
 */
export function ExploreTab() {
  const { ready, progress, update } = useProgress();
  const engine = useEngine();
  const { standings } = useStandings();
  const [draft, setDraft] = useState('');
  const [editingRegion, setEditingRegion] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);
  const [fetched, setFetched] = useState<EngineState['explore'] | null>(null);
  const [searching, setSearching] = useState(false);
  const [today, setToday] = useState<string | null>(null);
  const [justIn, setJustIn] = useState(false);
  const asked = useRef<string | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    setToday(new Date().toLocaleDateString('en-CA'));
  }, []);

  const region = progress.region?.trim() ?? '';
  const hidden = useMemo(() => new Set(progress.exploreHidden ?? []), [progress.exploreHidden]);
  const known = engine.state?.knows;
  const threads = useMemo(
    () =>
      threadsFor({
        items: progress.items,
        words: [progress.lifeText, ...progress.items.flatMap((i) => i.notes.map((n) => n.text))].join('\n'),
        standings,
        hasPeople: (known ?? []).some((f) => f.id.startsWith('person:')) || progress.asks.some((a) => a.q === 'Who do you want more time with?' && a.a !== 'Myself'),
      }),
    [progress.items, progress.lifeText, progress.asks, standings, known],
  );

  // What the engine last said, unless the search just came back with something newer.
  const live = engine.state?.explore ?? null;
  const explore = fetched && (!live?.at || (fetched.at ?? '') > live.at) ? fetched : live;

  // Once a week, when they open this: the server keeps it to that, whatever this asks.
  useEffect(() => {
    if (!engine.on || !region || !live?.available || searching) return;
    if (live.fresh && live.region?.toLowerCase() === region.toLowerCase()) return;
    if (asked.current === region.toLowerCase() || !threads.length) return;
    const key = region.toLowerCase();
    asked.current = key;
    setSearching(true);
    if (underway?.region !== key)
      underway = {
        region: key,
        result: engineApi
          .exploreFeed(region)
          .then((r) => r.state.explore)
          .catch(() => null)
          .finally(() => {
            underway = null;
          }),
      };
    void underway.result.then((found) => {
      if (found) setFetched(found);
      setSearching(false);
    });
  }, [engine.on, region, live, searching, threads.length]);

  const saveRegion = (value: string) => {
    const place = value.trim().slice(0, 80);
    if (!place) return;
    update({ region: place });
    setEditingRegion(false);
    setDraft('');
  };
  const hide = (id: string) => update((p) => ({ ...p, exploreHidden: [...(p.exploreHidden ?? []), id].slice(-200) }));

  const answer = async (card: Card, how: 'in' | 'no' | 'loved' | 'not-really') => {
    const isIdea = card.id.startsWith('idea:');
    track('explore_go', { how, idea: isIdea });
    // A place said no to stays out of this list, signed in or not.
    if (how === 'no' && isIdea) return hide(card.id);
    if (!engine.on) {
      if (how === 'in') {
        const { id, thread, title, when, where, url } = card;
        update((p) => ({
          ...p,
          exploreGoing: [...(p.exploreGoing ?? []).filter((g) => g.id !== id), { id, thread, title, url, ...(when ? { when } : {}), ...(where ? { where } : {}) }].slice(-50),
        }));
        setJustIn(true);
      } else update((p) => ({ ...p, exploreGoing: (p.exploreGoing ?? []).filter((g) => g.id !== card.id) }));
      return;
    }
    const done = await engine.act(() => engineApi.exploreGo(card.id, how, card.thread));
    if (done && how === 'in') setJustIn(true);
    // Said yes before signing in: the account has it now.
    if (done && how !== 'in') update((p) => ({ ...p, exploreGoing: (p.exploreGoing ?? []).filter((g) => g.id !== card.id) }));
  };

  const going: Card[] = useMemo(() => {
    const fromEngine = explore?.going ?? [];
    const ids = new Set(fromEngine.map((g) => g.id));
    return [...fromEngine, ...(progress.exploreGoing ?? []).filter((g) => !ids.has(g.id))];
  }, [explore?.going, progress.exploreGoing]);
  const goingIds = useMemo(() => new Set(going.map((g) => g.id)), [going]);

  const shownThreads = threads.filter((th) => !filter || th.id === filter);
  const becauseOf = (id: string) => threads.find((th) => th.id === id)?.because ?? '';
  const found: Card[] = ((explore?.events ?? []) as readonly Found[]).filter((e) => !filter || e.thread === filter);
  const places: Card[] = useMemo(
    () =>
      region
        ? nearbyFor(shownThreads, region, hidden)
            .filter((n) => !goingIds.has(n.id))
            .map((n) => ({ id: n.id, thread: n.thread, title: n.title, when: n.when, where: n.where, url: n.url, why: n.line }))
        : [],
    // shownThreads is rebuilt each render; its ids are what matter.
    [region, hidden, goingIds, shownThreads.map((th) => th.id).join()],
  );
  const cards = [...found, ...places];
  const year = today ? Number(today.slice(0, 4)) : new Date().getFullYear();
  const current = (known ?? []).find((f) => f.group === 'now');
  const asking = (!region || editingRegion) && threads.length > 0;
  const checked = explore?.at && explore.events.length ? longDate(explore.at.slice(0, 10)) : null;

  return (
    <main className="tb-page ex-page">
      <header className="tb-header">
        <div>
          <span>{t.eyebrow}</span>
          <h1>{t.title}</h1>
        </div>
        <Mark />
      </header>
      <p className="ex-line">{t.line}</p>

      {ready && !threads.length ? (
        <section className="ex-card">
          <h2>{t.nothingTitle}</h2>
          <p>{t.nothingLine}</p>
          <Link className="ds-primary" href="/things" style={{ marginTop: 14 }}>
            {t.nothingGo}
            <Arrow />
          </Link>
        </section>
      ) : null}

      {asking ? (
        <section className="ex-card">
          <h2>{t.whereTitle}</h2>
          <p>{t.whereLine}</p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              saveRegion(draft);
            }}
          >
            <input
              className="ds-field"
              aria-label={t.whereLabel}
              placeholder={t.wherePlaceholder}
              maxLength={80}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="ds-primary" disabled={!draft.trim()}>
              {t.whereGo}
              <Arrow />
            </button>
          </form>
        </section>
      ) : null}

      {region && !asking && threads.length ? (
        <>
          <div className="ex-near">
            <span>{t.near(region)}</span>
            <button
              type="button"
              className="ds-link ds-link--quiet"
              onClick={() => {
                setDraft(region);
                setEditingRegion(true);
              }}
            >
              {t.change}
            </button>
          </div>

          {current ? <p className="ex-note">{t.keeping(current.text.toLowerCase())}</p> : null}

          {going.length ? (
            <section className="ex-section" aria-label={t.going}>
              <h2>{t.going}</h2>
              {justIn ? (
                <p className="rt-done" role="status">
                  {engine.on ? t.onRitual : t.onPhone}
                </p>
              ) : null}
              {going.map((e) => (
                <article key={e.id} className="ex-event">
                  <small>{e.past && e.date ? longDate(e.date) : whenOf(e, today)}</small>
                  <strong>{e.title}</strong>
                  {e.where ? <p className="ex-where">{e.where}</p> : null}
                  {e.past ? (
                    <div className="ex-idea-actions">
                      <span>{t.howWas}</span>
                      <button type="button" className="ds-spark" disabled={engine.busy} onClick={() => void answer(e, 'loved')}>
                        {t.loved}
                      </button>
                      <button type="button" className="ds-link" disabled={engine.busy} onClick={() => void answer(e, 'not-really')}>
                        {t.notReally}
                      </button>
                    </div>
                  ) : (
                    <div className="ex-idea-actions">
                      <a className="ds-link ds-link--quiet" href={e.url} target="_blank" rel="noopener noreferrer">
                        {t.page}
                      </a>
                      {e.date ? null : (
                        <button type="button" className="ds-link ds-link--quiet" disabled={engine.busy} onClick={() => void answer(e, 'not-really')}>
                          {t.doneWith}
                        </button>
                      )}
                    </div>
                  )}
                </article>
              ))}
            </section>
          ) : null}

          {threads.length > 1 ? (
            <div className="ex-filter" role="group" aria-label={t.leads}>
              <button type="button" className="ds-bubble" aria-pressed={!filter} onClick={() => setFilter(null)}>
                {t.all}
              </button>
              {threads.map((th) => (
                <button key={th.id} type="button" className="ds-bubble" aria-pressed={filter === th.id} onClick={() => setFilter(filter === th.id ? null : th.id)}>
                  {th.name}
                </button>
              ))}
            </div>
          ) : null}

          {cards.length || searching ? (
            <section className="ex-section" aria-label={t.found}>
              <h2>{t.found}</h2>
              <p>{checked ? t.updated(checked) : t.foundNote}</p>
              {searching ? (
                <p className="ex-searching" role="status">
                  <Mark size="sm" turning />
                  <span>{t.searching}</span>
                </p>
              ) : null}
              {cards.map((e) => (
                <article key={e.id} className="ex-event">
                  <small>{whenOf(e, today)}</small>
                  <strong>{e.title}</strong>
                  {e.where ? <p className="ex-where">{e.where}</p> : null}
                  {e.why ? <p className="ex-why">{e.why}</p> : null}
                  <span className="ex-from">{becauseOf(e.thread)}</span>
                  <div className="ex-idea-actions">
                    <button type="button" className="ds-spark" disabled={engine.busy} onClick={() => void answer(e, 'in')}>
                      {t.in}
                    </button>
                    <button type="button" className="ds-link" disabled={engine.busy} onClick={() => void answer(e, 'no')}>
                      {t.no}
                    </button>
                    <a className="ds-link ds-link--quiet" href={e.url} target="_blank" rel="noopener noreferrer">
                      {t.page}
                    </a>
                  </div>
                </article>
              ))}
            </section>
          ) : null}

          <section className="ex-section" aria-label={t.leads}>
            <h2>{t.leads}</h2>
            {shownThreads.map((th) => {
              const avenues = th.avenues.filter((a) => !hidden.has(a.id));
              if (!avenues.length) return null;
              return (
                <div key={th.id}>
                  {avenues.map((a, i) => (
                    <div key={a.id} className="ex-lead">
                      {i === 0 ? <small>{th.because}</small> : null}
                      <strong style={i === 0 ? { marginTop: 6 } : undefined}>{a.title}</strong>
                      <p>{a.line}</p>
                      <div className="ex-idea-actions">
                        <a className="ds-link" href={leadUrl(a, region, year)} target="_blank" rel="noopener noreferrer">
                          {t.look(region)}
                        </a>
                        <button type="button" className="ds-link ds-link--quiet" onClick={() => hide(a.id)}>
                          {t.no}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </section>

          {!engine.on && ready ? (
            <p className="ex-note" style={{ marginTop: 20 }}>
              {t.signedOutNote}
            </p>
          ) : null}
        </>
      ) : null}
    </main>
  );
}
