'use client';

import { useEffect, useRef, useState } from 'react';
import type { RitualPart } from '@distill/engine/ritual';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { revealRitual, shapeRitual } from '../../../lib/engine/preview';
import { alwaysYours, momentLines, type RevealNotes } from '../../../lib/onboarding/reveal';
import { asSaid, atBestLine, becomingLine, lifePicks, listOf, midSentence } from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const names = (xs: readonly string[]) => listOf(xs.map((x, i) => (i ? midSentence(x) : x)));

/**
 * Step 6: their first Ritual. The rules version shows at once; when Claude is on, its version
 * (named and paired in their words) replaces it when ready. One short line each.
 */
export function Reveal() {
  const go = useGo();
  const { ready, progress } = useProgress();
  const [draft, setDraft] = useState<{ parts: readonly RitualPart[]; notes: RevealNotes } | null>(null);
  const [shaping, setShaping] = useState(false);
  const [shaped, setShaped] = useState(false);
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    revealRitual(progress, zone)
      .then((r) => {
        setDraft({ parts: r.parts, notes: r.notes });
        if (!r.shaping) return;
        setShaping(true);
        return shapeRitual(progress, zone).then((s) => {
          if (s) {
            setDraft((d) => (d ? { ...d, parts: s.parts } : d));
            setShaped(true);
          }
        });
      })
      .catch(() => setFailed(true))
      .finally(() => setShaping(false));
  }, [ready, progress]);

  const best = ready ? atBestLine(progress) : null;
  const toward = ready ? becomingLine(progress) : null;

  return (
    <section className="stack screen-reveal" aria-busy={!draft && !failed}>
      <h1>{copy.reveal.title}</h1>

      {best || toward ? (
        <div className="reveal-best">
          <p className="goals-label">{copy.reveal.atBest}</p>
          <p className="reveal-best-line">{[best, toward].filter(Boolean).join(' ')}</p>
        </div>
      ) : null}

      {failed ? (
        <p className="notice" role="alert">
          {copy.reveal.error}
        </p>
      ) : !draft ? (
        <Skeleton kind="option" count={3} />
      ) : (
        <Draft
          parts={draft.parts}
          notes={draft.notes}
          picks={lifePicks(progress)}
          shaping={shaping}
          shaped={shaped}
        />
      )}

      <p className="reveal-moves">{copy.reveal.moves}</p>

      <div className="actions">
        <Button onClick={() => go('invitation')}>
          {copy.reveal.accept}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}

function Draft({
  parts,
  notes,
  picks,
  shaping,
  shaped,
}: {
  parts: readonly RitualPart[];
  notes: RevealNotes;
  picks: readonly string[];
  shaping: boolean;
  shaped: boolean;
}) {
  const moments = momentLines(parts);
  const always = alwaysYours(parts, picks);
  return (
    <>
      <div className={`reveal-card${shaped ? ' reveal-shaped' : ''}`} aria-live="polite">
        {moments.map((m) => (
          <div key={`${m.key}-${shaped}`} className={`reveal-row reveal-${m.key}`}>
            <span className="reveal-label">{m.label}</span>
            <p>{m.text}</p>
          </div>
        ))}
        {always.length ? (
          <div className="reveal-row reveal-always">
            <span className="reveal-label">{copy.reveal.always}</span>
            <p>{listOf(always.map((x, i) => (i ? asSaid(x) : x)))}.</p>
          </div>
        ) : null}
        {!moments.length && !always.length ? <p className="reveal-empty">{copy.reveal.empty}</p> : null}
        {shaping ? <p className="reveal-shaping">{copy.reveal.shaping}</p> : null}
      </div>

      {notes.letGo.length ? (
        <div className="reveal-notes">
          <p className="goals-label">{copy.reveal.letGoTitle}</p>
          {notes.letGo.map((l) => (
            <p key={l.name}>
              {l.yearly > 0 ? copy.reveal.letGo(l.name, money(l.yearly)) : copy.reveal.letGoFree(l.name)}
            </p>
          ))}
        </div>
      ) : notes.wellFounded.length ? (
        <p className="reveal-clean">
          <strong>{copy.reveal.clean}</strong>{' '}
          {copy.reveal.wellFounded(names(notes.wellFounded), notes.wellFounded.length)}
        </p>
      ) : null}

      {notes.worthALook.map((n) => (
        <p key={n} className="reveal-look">
          {copy.reveal.worthALook(n)}
        </p>
      ))}
    </>
  );
}
