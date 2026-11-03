'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { RitualPart } from '@distill/engine/ritual';
import { RitualToken } from '../../../components/ds/ritual-token';
import { Arrow, Brand, Locked, Mark } from '../../../components/ds/ui';
import { useGo } from '../../../components/onboarding/go';
import { copy } from '../../../lib/copy';
import { revealRitual, shapeRitual } from '../../../lib/engine/preview';
import { alwaysYours, type RevealNotes } from '../../../lib/onboarding/reveal';
import { lifePicks, protectedThing, wakeSaid } from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';
import { revealGroups } from '../../../lib/ritual-groups';
import { NUMBERED_STEPS } from '../../../lib/steps';

const r = copy.app.ritual;
const money = (n: number) => Math.round(n).toLocaleString('en-US');
/** "Shaping it around you" shows at least this long, so the moment registers. */
const SHAPING_MS = 1200;
/** How long the parts gather before the invitation opens. */
const GATHER_MS = 720;

const still = () =>
  typeof window !== 'undefined' &&
  (document.documentElement.dataset.motion === 'reduce' ||
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Step 5: their first Ritual. The rules version shows at once; when Claude is on, its version
 * (named and paired in their words) replaces it when ready. "Make it mine" is their yes: the parts
 * gather into one card, which travels with them to the app.
 */
export function Reveal() {
  const go = useGo();
  const router = useRouter();
  const { ready, progress } = useProgress();
  const [draft, setDraft] = useState<{ parts: readonly RitualPart[]; notes: RevealNotes } | null>(null);
  const [shaping, setShaping] = useState(false);
  const [failed, setFailed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [gathering, setGathering] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const t = window.setTimeout(() => setSettled(true), still() ? 0 : SHAPING_MS);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    revealRitual(progress, zone)
      .then((res) => {
        setDraft({ parts: res.parts, notes: res.notes });
        if (!res.shaping) return;
        setShaping(true);
        return shapeRitual(progress, zone).then((s) => {
          if (s) setDraft((d) => (d ? { ...d, parts: s.parts } : d));
        });
      })
      .catch(() => setFailed(true))
      .finally(() => setShaping(false));
  }, [ready, progress]);

  if ((!draft && !failed) || !settled)
    return (
      <main className="rv-shaping" aria-busy="true">
        <Mark />
        <span>{copy.reveal.shaping}</span>
        <i />
      </main>
    );

  const picks = [...lifePicks(progress), protectedThing(progress)].filter((x): x is string => !!x);
  const notes = draft?.notes;
  const parts = failed ? [] : (draft?.parts ?? []);
  const groups = revealGroups(parts, notes?.wellFounded ?? []);
  const always = draft ? alwaysYours(draft.parts, picks) : [];
  const letGo = notes?.letGo ?? [];
  const clean = !!notes && !letGo.length && notes.wellFounded.length > 0;
  const wake = wakeSaid(progress);
  const name = progress.name.trim().split(/\s+/)[0];

  const accept = () => {
    if (gathering) return;
    setGathering(true);
    window.setTimeout(() => go('invitation'), still() ? 0 : GATHER_MS);
  };

  return (
    <main className={`rv${gathering ? ' is-gathering' : ''}`}>
      <div className="rv-progress">
        <div className="rv-progress-row">
          <button type="button" className="ob-back" onClick={() => router.push('/study')}>
            {copy.common.back}
          </button>
          <span>05 of {String(NUMBERED_STEPS).padStart(2, '0')}</span>
        </div>
        <span className="ob-line">
          <i style={{ width: `${(5 / NUMBERED_STEPS) * 100}%` }} />
        </span>
      </div>
      <Brand />
      <section className="rv-intro">
        {name ? <span className="ds-eyebrow">{name}</span> : null}
        <h1>
          {r.titleStart} {r.titleEnd}
        </h1>
        <p>{wake ? `${wake}, ${r.wakes}` : r.subtitle}</p>
      </section>

      {failed ? (
        <p className="ds-notice" role="alert">
          {copy.reveal.error}
        </p>
      ) : null}

      {groups.length ? (
        <div className="rv-groups" aria-live="polite">
          {groups.map((g) => (
            <section key={g.key} className="rv-group" aria-label={g.label}>
              <h2>{g.label}</h2>
              <ul>
                {g.rows.map((row) => (
                  <li key={row.id} className="rv-part">
                    <span className="rv-part-time">{row.when}</span>
                    <strong>{row.title}</strong>
                    {row.why ? <p>{row.why}</p> : null}
                    {row.yours ? <Locked>{copy.reveal.locked}</Locked> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : !always.length && !failed ? (
        <section className="rv-empty">
          <Mark size="sm" />
          <p>{copy.reveal.empty}</p>
        </section>
      ) : null}
      {shaping ? <p className="rv-note">{copy.reveal.shaping}</p> : null}

      {always.length ? (
        <section className="rv-always" aria-label={r.always}>
          <span className="ds-eyebrow">{r.always}</span>
          <ul>
            {always.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {letGo.length ? (
        <section className="rv-letgo" aria-label={r.letGo}>
          <span className="ds-eyebrow">{r.letGo}</span>
          <ul className="rv-letgo-list" style={{ display: 'grid', gap: 10 }}>
            {letGo.map((l) => (
              <li key={l.name}>
                <strong>{l.name}</strong>
                {l.yearly > 0 ? <span className="rv-money">{r.yearBack(money(l.yearly))}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : clean ? (
        <p className="rv-clean">{copy.reveal.clean}</p>
      ) : null}

      {notes?.worthALook.length ? (
        <section className="rv-worth" aria-label={r.worthALook}>
          <span className="ds-eyebrow">{r.worthALook}</span>
          <p>{r.noEvidence}</p>
          <ul>
            {notes.worthALook.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="rv-actions">
        <button type="button" className="ds-primary" onClick={accept}>
          {copy.reveal.accept}
          <Arrow />
        </button>
        <button type="button" className="ds-link" onClick={() => router.push('/study')}>
          {r.change}
        </button>
        <p className="rv-ownership">{r.footnote}</p>
      </div>
      {gathering ? <RitualToken arriving /> : null}
    </main>
  );
}
