'use client';

import { useEffect, useState } from 'react';
import { Arrow, Mark } from '../../../components/ds/ui';
import { copy } from '../../../lib/copy';
import { engineApi } from '../../../lib/engine/client';
import { useEngine } from '../../../lib/engine/context';
import { useProgress } from '../../../lib/progress/context';

const t = copy.exploreTab;

/**
 * Explore: new things that fit them, only once their Ritual is steady. The engine opens it (no
 * noise left to clear, a week after their first Ritual, not in a busy or unwell season) and shows
 * only ideas Veer has certified. Until then, the early state and what Distill has learned so far.
 */
export function ExploreTab() {
  const { progress } = useProgress();
  const { on, state, last, act, busy } = useEngine();
  const [want, setWant] = useState('');
  const [region, setRegion] = useState('');
  const [answered, setAnswered] = useState<Record<string, 'add' | 'decline'>>({});
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, []);
  const learned = (progress.picture?.lines ?? []).slice(0, 4);
  const open = on && state?.today.kind === 'explore';
  const options = last?.explore?.options;

  return (
    <main className="tb-page ex-page">
      <header className="tb-header">
        <div>
          <span>{t.eyebrow}</span>
          <h1>{t.title}</h1>
        </div>
        <Mark />
      </header>

      {open ? (
        <section className="ex-card">
          <span className="ds-eyebrow">{t.open}</span>
          <h2>{copy.explore.ask}</h2>
          <p>{copy.explore.line}</p>
          {options ? (
            <ul>
              {options.map((o) => (
                <li key={o.ideaId} className="ex-idea">
                  <strong>{o.title}</strong>
                  <p>{o.why}</p>
                  {answered[o.ideaId] ? (
                    <p className="rt-done">{answered[o.ideaId] === 'add' ? copy.explore.added : copy.explore.declined}</p>
                  ) : (
                    <div className="ex-idea-actions">
                      <button
                        type="button"
                        className="ds-spark"
                        disabled={busy}
                        onClick={async () => {
                          if (await act(() => engineApi.exploreAnswer(o.ideaId, 'add'))) setAnswered((a) => ({ ...a, [o.ideaId]: 'add' }));
                        }}
                      >
                        {copy.explore.add}
                      </button>
                      <button
                        type="button"
                        className="ds-link"
                        disabled={busy}
                        onClick={async () => {
                          if (await act(() => engineApi.exploreAnswer(o.ideaId, 'decline'))) setAnswered((a) => ({ ...a, [o.ideaId]: 'decline' }));
                        }}
                      >
                        {copy.explore.no}
                      </button>
                      <a className="ds-link ds-link--quiet" href={o.url} target="_blank" rel="noopener noreferrer">
                        {copy.explore.open}
                      </a>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (want.trim()) void act(() => engineApi.explore(want.trim(), region.trim() || undefined));
              }}
            >
              <input className="ds-field" aria-label={copy.explore.label} placeholder={copy.explore.placeholder} maxLength={600} value={want} onChange={(e) => setWant(e.target.value)} />
              <input className="ds-field" aria-label={copy.explore.region} placeholder={copy.explore.regionPlaceholder} maxLength={80} value={region} onChange={(e) => setRegion(e.target.value)} />
              <button type="submit" className="ds-primary" disabled={busy || !want.trim()}>
                {copy.explore.go}
                <Arrow />
              </button>
            </form>
          )}
        </section>
      ) : (
        <section className="ex-card">
          <span className="ds-eyebrow">{t.early}</span>
          <h2>{t.settleTitle}</h2>
          <p>{t.settleLine}</p>
        </section>
      )}

      {learned.length ? (
        <section className="ex-learned" aria-label={t.learned}>
          <h2>{t.learned}</h2>
          <ul>
            {learned.map((l) => (
              <li key={l.id}>
                <Mark size="xs" />
                <span>{l.text}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
