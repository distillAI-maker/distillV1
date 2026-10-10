'use client';

import { useState } from 'react';
import s from './home.module.css';

/** CC0 images from The Metropolitan Museum of Art's open access collection, via Wikimedia Commons. */
const goddess =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/5/54/Marble_head_of_a_goddess_MET_DP323894.jpg/960px-Marble_head_of_a_goddess_MET_DP323894.jpg';
const lake =
  'https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a9/Lake_George_MET_DT84.jpg/1280px-Lake_George_MET_DT84.jpg';

type Status = 'kept' | 'reading' | 'let go';
const collection: { name: string; kind: string; from: string; cost: number; status: Status }[] = [
  { name: 'Equinox', kind: 'Premium gym', from: 'a friend', cost: 250, status: 'kept' },
  { name: 'Pilates', kind: 'Reformer, twice a week', from: 'a friend', cost: 160, status: 'kept' },
  {
    name: 'Evening drinks',
    kind: 'Three nights a week',
    from: 'friends',
    cost: 80,
    status: 'reading',
  },
  { name: 'AG1', kind: 'Greens powder', from: 'a podcast', cost: 90, status: 'reading' },
  { name: "Barry's", kind: 'Boutique classes', from: 'a friend', cost: 200, status: 'let go' },
  {
    name: 'Collagen gummies',
    kind: 'Beauty supplement',
    from: 'TikTok',
    cost: 40,
    status: 'let go',
  },
];

export function HomeMock() {
  const [today, setToday] = useState<'open' | 'let go' | 'kept'>('open');
  return (
    <div className={s.page}>
      <header className={s.top}>
        <span className={s.wordmark}>Distill</span>
        <span className={s.date}>Thursday, 9 October</span>
      </header>

      <main className={s.main}>
        <figure className={s.plate}>
          <img src={goddess} alt="A marble head of a goddess, in profile." />
          <figcaption>Marble head of a goddess. The Met, open access.</figcaption>
        </figure>

        <p className={s.inscription}>Know thyself</p>
        <h1 className={s.title}>Maya, at your best.</h1>
        <ul className={s.portrait} aria-label="In your words">
          <li>Mornings outside, before the phone.</li>
          <li>Pilates with people you like.</li>
          <li>Fridays, fully present.</li>
        </ul>
        <p className={s.caption}>In your words, 2 October.</p>

        <section className={s.standard} aria-label="Your Standard">
          <p className={s.eyebrow}>Your Standard</p>
          <div className={s.figures}>
            <div>
              <strong>11</strong>
              <span>things, from 21</span>
            </div>
            <div>
              <strong>$661</strong>
              <span>a month, from $1,428</span>
            </div>
          </div>
          <p className={s.back}>$767 a month back to you.</p>
        </section>

        <section className={s.today} aria-label="Today">
          <p className={s.eyebrow}>Today · one thing</p>
          {today === 'open' ? (
            <>
              <h2>Restore studio</h2>
              <p>One visit in two months, at $250 a month.</p>
              <div className={s.actions}>
                <button type="button" className={s.primary} onClick={() => setToday('let go')}>
                  Let it go
                </button>
                <button type="button" className={s.secondary} onClick={() => setToday('kept')}>
                  Keep it
                </button>
              </div>
            </>
          ) : (
            <>
              <h2>{today === 'let go' ? 'Let go.' : 'Kept. It stays yours.'}</h2>
              <p>
                {today === 'let go'
                  ? '$250 a month back. Lighter already.'
                  : 'Nothing else to do today.'}
              </p>
              <button type="button" className={s.link} onClick={() => setToday('open')}>
                Undo
              </button>
            </>
          )}
        </section>

        <section className={s.noticing} aria-label="What we're noticing">
          <p className={s.eyebrow}>What we're noticing</p>
          <article>
            <p>Your deepest sleep follows Pilates days.</p>
            <span>From 34 nights · fairly sure</span>
          </article>
          <article>
            <p>
              An evening with drinks costs you about a day of recovery. Worth it sometimes. Now you
              know.
            </p>
            <span>From 22 evenings · still reading</span>
          </article>
        </section>

        <section aria-label="The collection">
          <div className={s.sectionHead}>
            <p className={s.eyebrow}>The collection</p>
            <span className={s.all}>All 21</span>
          </div>
          <ul className={s.placards}>
            {collection.map((c) => (
              <li key={c.name} className={c.status === 'let go' ? s.gone : undefined}>
                <span className={s.status}>
                  {c.status === 'reading' ? 'Being read' : c.status === 'kept' ? 'Kept' : 'Let go'}
                </span>
                <span className={s.pname}>{c.name}</span>
                <span className={s.pmeta}>
                  {c.kind} · from {c.from}
                </span>
                <span className={s.pcost}>
                  {c.status === 'let go' ? `$${c.cost} back` : `$${c.cost} a month`}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className={s.forYou} aria-label="When you're ready">
          <figure className={s.wide}>
            <img src={lake} alt="A calm mountain lake at dawn, painted." />
            <figcaption>Lake George. The Met, open access.</figcaption>
          </figure>
          <p className={s.eyebrow}>When you're ready</p>
          <h2>A Pilates weekend at Lake Tahoe.</h2>
          <p>Chosen for how you sleep after Pilates, and the mornings you want outside.</p>
          <button type="button" className={s.secondary}>
            Tell me more
          </button>
        </section>

        <p className={s.closing}>Nothing in excess</p>
      </main>

      <nav className={s.tabs} aria-label="App">
        <span>Today</span>
        <span className={s.on}>Standard</span>
        <span>Collection</span>
        <span>You</span>
      </nav>
    </div>
  );
}
