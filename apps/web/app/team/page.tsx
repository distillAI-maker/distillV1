import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { currentUser } from '../../lib/supabase/server';
import { isTeam } from '../../lib/team';
import {
  buildReport,
  duration,
  funnelSql,
  isRange,
  loadSources,
  loadTrails,
  percent,
  rangeStart,
  ranges,
  type Range,
  type Report,
} from '../../src/server/funnel-report';
import { CountToggle } from './count-toggle';
import './team.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Funnel', robots: { index: false, follow: false } };

const SOURCE = /^[A-Za-z0-9_.-]{1,40}$/;

/**
 * The team's view of the funnel: how far people get through onboarding, the screen they were on
 * when they stopped, how long each screen takes, and what they do in the app. Only for the
 * addresses in TEAM_EMAILS (lib/team.ts). docs/FUNNEL.md explains every number.
 */
export default async function TeamPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect('/sign-in');
  if (!isTeam(user)) notFound();

  const params = await searchParams;
  const range: Range = isRange(params.range) ? params.range : '7d';
  const source = typeof params.src === 'string' && SOURCE.test(params.src) ? params.src : null;
  const sql = funnelSql();
  const now = Date.now();
  let body: ReactNode;
  let sources: string[] = [];
  if (!sql) {
    body = <p className="tm-note">No events database here: DATABASE_URL isn&apos;t set for this deployment.</p>;
  } else {
    try {
      const [{ trails, capped }, found] = await Promise.all([
        loadTrails(sql, { from: rangeStart(range, now), source }),
        loadSources(sql),
      ]);
      sources = found;
      body = <Funnel report={buildReport(trails, now)} capped={capped} />;
    } catch {
      body = <p className="tm-note">Couldn&apos;t read the events just now. Try again in a minute.</p>;
    }
  }

  const href = (next: { range?: Range; src?: string | null }) => {
    const q = new URLSearchParams();
    const r = next.range ?? range;
    const s = next.src === undefined ? source : next.src;
    if (r !== '7d') q.set('range', r);
    if (s) q.set('src', s);
    const qs = q.toString();
    return qs ? `/team?${qs}` : '/team';
  };

  return (
    <div className="ds tm">
      <header className="tm-head">
        <div>
          <span className="tm-kicker">Distill · team only</span>
          <h1>Where people stop</h1>
        </div>
        <nav className="tm-filters" aria-label="Filters">
          <div className="tm-chips" role="group" aria-label="When they arrived">
            {(Object.keys(ranges) as Range[]).map((r) => (
              <Link key={r} href={href({ range: r })} className="tm-chip" aria-current={r === range ? 'true' : undefined}>
                {ranges[r]}
              </Link>
            ))}
          </div>
          {sources.length ? (
            <div className="tm-chips" role="group" aria-label="Where they came from">
              <Link href={href({ src: null })} className="tm-chip" aria-current={!source ? 'true' : undefined}>
                All sources
              </Link>
              {sources.map((s) => (
                <Link key={s} href={href({ src: s })} className="tm-chip" aria-current={s === source ? 'true' : undefined}>
                  {s}
                </Link>
              ))}
            </div>
          ) : null}
        </nav>
      </header>
      <main className="tm-main">{body}</main>
      <footer className="tm-foot">
        <CountToggle />
        <p>
          People are grouped by when this device was first counted. A device is one browser on one phone or computer, so the
          email link opening in the mail app&apos;s browser counts as a new one. Only screens, times and taps are stored: never
          what anyone writes, their name or their email. More in <code>docs/FUNNEL.md</code>.
        </p>
      </footer>
    </div>
  );
}

function Funnel({ report: r, capped }: { report: Report; capped: boolean }) {
  if (!r.people && !r.app.people)
    return <p className="tm-note">Nobody yet in this range. Screens are counted from the first visit after this page shipped.</p>;
  const biggest = r.path.find((p) => p.id === r.biggestLoss);
  const steepest = r.steepestLoss !== r.biggestLoss ? r.path.find((p) => p.id === r.steepestLoss) : undefined;
  return (
    <>
      {capped ? <p className="tm-note">Showing the latest 5,000 people in this range.</p> : null}
      <section className="tm-stats" aria-label="Summary">
        <Stat label="Started onboarding" value={r.people} />
        <Stat label="Reached the app" value={r.finished} sub={r.people ? percent(r.finished / r.people) : undefined} />
        <Stat label="Stopped" value={r.stoppedTotal} />
        <Stat label="Still going" value={r.stillGoing} sub="active in the last 30 min" />
        <Stat label="Median time to the app" text={duration(r.medianFinishMs)} />
      </section>

      {biggest ? (
        <p className="tm-callout">
          Most people stop at <strong>{biggest.label}</strong>: {biggest.stopped} of the {biggest.reached} who got there went no
          further ({percent(biggest.stoppedShare)}).
          {steepest ? (
            <>
              {' '}
              The steepest drop is <strong>{steepest.label}</strong>: {percent(steepest.stoppedShare)} of the {steepest.reached}{' '}
              who reach it stop there.
            </>
          ) : null}
        </p>
      ) : null}

      <section className="tm-card">
        <h2>The path</h2>
        <p className="tm-hint">
          How many got at least this far, how many got this far and no further, and the median time spent on each screen.
        </p>
        <div className="tm-table" role="table" aria-label="The onboarding path">
          <div className="tm-row tm-row--head tm-row--bar" role="row">
            <span role="columnheader">Screen</span>
            <span role="columnheader">Reached</span>
            <span role="columnheader" className="tm-num">Stopped here</span>
            <span role="columnheader" className="tm-num">Time on it</span>
          </div>
          {r.path.map((p, i) => (
            <div key={p.id} role="row" className={`tm-row tm-row--bar${p.id === r.biggestLoss ? ' is-worst' : ''}`}>
              <span role="cell" className="tm-screen">
                <i>{i + 1}</i>
                {p.label}
              </span>
              <span role="cell" className="tm-bar-cell">
                <span className="tm-bar">
                  <span style={{ width: `${Math.max(p.share * 100, p.reached ? 1.5 : 0)}%` }} />
                </span>
                <b>{p.reached}</b>
                <small>{percent(p.share)}</small>
              </span>
              <span role="cell" className={`tm-num${p.id === r.steepestLoss ? ' is-steep' : ''}`}>
                {p.stopped ? (
                  <>
                    {p.stopped} <small>{percent(p.stoppedShare)}</small>
                  </>
                ) : (
                  '–'
                )}
              </span>
              <span role="cell" className="tm-num" title={p.timed ? `from ${p.timed} visits` : undefined}>
                {duration(p.medianMs)}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="tm-card">
        <h2>Where they were when they stopped</h2>
        <p className="tm-hint">
          The last screen each person saw, for everyone who stopped short of the app and hasn&apos;t been back for 30 minutes.
        </p>
        {r.stopped.length ? (
          <div className="tm-table" role="table" aria-label="Where people stopped">
            <div className="tm-row tm-row--head tm-row--three tm-row--bar" role="row">
              <span role="columnheader">Last screen</span>
              <span role="columnheader">People</span>
              <span role="columnheader" className="tm-num">Time there</span>
            </div>
            {r.stopped.map((s) => (
              <div key={s.id} className="tm-row tm-row--three tm-row--bar" role="row">
                <span role="cell" className="tm-screen">{s.label}</span>
                <span role="cell" className="tm-bar-cell">
                  <span className="tm-bar tm-bar--stop">
                    <span style={{ width: `${Math.max(s.share * 100, 1.5)}%` }} />
                  </span>
                  <b>{s.people}</b>
                  <small>{percent(s.share)}</small>
                </span>
                <span role="cell" className="tm-num">{duration(s.medianMs)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="tm-note">Nobody has stopped in this range.</p>
        )}
      </section>

      <div className="tm-grid">
        <section className="tm-card">
          <h2>Along the way</h2>
          <List
            rows={[
              ...r.taps.filter((t) => t.id !== 'email_confirmed'),
              { id: 'confirmed', label: 'Opened the email link, same browser', people: r.taps.find((t) => t.id === 'email_confirmed')?.people ?? 0 },
              { id: 'anywhere', label: 'Opened the email link, any browser', people: r.confirmedAnywhere },
              ...r.branches.map((b) => ({ ...b, label: `Saw ${b.label}` })),
            ]}
          />
        </section>

        <section className="tm-card">
          <h2>In the app</h2>
          <List
            rows={[
              { id: 'people', label: 'Opened the app', people: r.app.people },
              { id: 'in', label: 'Signed in', people: r.app.signedIn },
              { id: 'demo', label: 'Only the demo (signed out)', people: r.app.demo },
              { id: 'back', label: 'Came back on another day', people: r.app.returned },
              ...r.app.tabs.map((t) => ({ ...t, label: `Opened ${t.label}` })),
            ]}
          />
          <h3>What they did</h3>
          <List rows={r.app.actions} times />
        </section>
      </div>

      <div className="tm-grid">
        <section className="tm-card">
          <h2>Where they came from</h2>
          <div className="tm-table" role="table" aria-label="Sources">
            <div className="tm-row tm-row--head tm-row--three" role="row">
              <span role="columnheader">Source</span>
              <span role="columnheader" className="tm-num">Started</span>
              <span role="columnheader" className="tm-num">Reached the app</span>
            </div>
            {r.sources.map((s) => (
              <div key={s.source} className="tm-row tm-row--three" role="row">
                <span role="cell" className="tm-screen">{s.source}</span>
                <span role="cell" className="tm-num">{s.people}</span>
                <span role="cell" className="tm-num">
                  {s.finished} <small>{percent(s.people ? s.finished / s.people : 0)}</small>
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="tm-card">
          <h2>By day</h2>
          <div className="tm-table" role="table" aria-label="By day">
            <div className="tm-row tm-row--head tm-row--three" role="row">
              <span role="columnheader">Day (Pacific)</span>
              <span role="columnheader" className="tm-num">Started</span>
              <span role="columnheader" className="tm-num">Reached the app</span>
            </div>
            {r.days.map((d) => (
              <div key={d.day} className="tm-row tm-row--three" role="row">
                <span role="cell" className="tm-screen">{d.day}</span>
                <span role="cell" className="tm-num">{d.people}</span>
                <span role="cell" className="tm-num">{d.finished}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="tm-card tm-card--quiet">
        <h2>Milestones</h2>
        <p className="tm-hint">The older once-per-device counts, kept so numbers from before screens were counted still compare.</p>
        <List rows={r.milestones} />
      </section>
    </>
  );
}

function Stat({ label, value, text, sub }: { label: string; value?: number; text?: string; sub?: string }) {
  return (
    <div className="tm-stat">
      <span>{label}</span>
      <strong>{text ?? value}</strong>
      {sub ? <small>{sub}</small> : null}
    </div>
  );
}

function List({ rows, times }: { rows: { id: string; label: string; people: number; times?: number }[]; times?: boolean }) {
  return (
    <ul className="tm-list">
      {rows.map((row) => (
        <li key={row.id}>
          <span>{row.label}</span>
          <b>
            {row.people}
            {times && row.times ? <small> · {row.times} times</small> : null}
          </b>
        </li>
      ))}
    </ul>
  );
}
