'use client';

import { useEffect, useRef, useState } from 'react';
import type { RitualPart } from '@distill/engine/ritual';
import { useGo } from '../../../components/onboarding/go';
import { Icon } from '../../../components/icon';
import { Button, Skeleton } from '../../../components/ui';
import { copy } from '../../../lib/copy';
import { revealRitual, shapeRitual } from '../../../lib/engine/preview';
import { alwaysYours, momentCards, type CardRow, type RevealNotes } from '../../../lib/onboarding/reveal';
import { asSaid, atBestLine, lifePicks, listOf, protectedThing } from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';

const money = (n: number) => Math.round(n).toLocaleString('en-US');
const n2 = (i: number) => String(i + 1).padStart(2, '0');

/**
 * Step 6: their first Ritual, drawn as the brand board's cabinet: a linen morning card and an ink
 * evening card with a numbered hairline row a part. The rules version shows at once; when Claude
 * is on, its version (named and paired in their words) replaces it when ready.
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

  return (
    <section className="screen-reveal" aria-busy={!draft && !failed}>
      <header className="reveal-head">
        <h1>{copy.reveal.title}</h1>
        {best ? (
          <div className="reveal-best">
            <p className="eyebrow-ink">{copy.reveal.atBest}</p>
            <p className="reveal-best-line">{best}</p>
          </div>
        ) : null}
      </header>

      {failed ? (
        <p className="notice" role="alert">
          {copy.reveal.error}
        </p>
      ) : !draft ? (
        <Skeleton kind="option" count={3} />
      ) : (
        <Cabinet
          parts={draft.parts}
          notes={draft.notes}
          picks={[...lifePicks(progress), protectedThing(progress)].filter((x): x is string => !!x)}
          shaping={shaping}
          shaped={shaped}
        />
      )}

      <div className="actions">
        <Button onClick={() => go('invitation')}>
          {copy.reveal.accept}
          <Icon name="arrow" size={18} />
        </Button>
      </div>
    </section>
  );
}

function Rows({ rows, label, ring = true }: { rows: readonly CardRow[]; label: string; ring?: boolean }) {
  return (
    <ol className="cab-rows" aria-label={label}>
      {rows.map((r, i) => (
        <li key={r.id} className="cab-row">
          <span className="cab-n" aria-hidden="true">
            {n2(i)}
          </span>
          <span className="cab-body">
            <span className="cab-title">{r.title}</span>
            {r.meta ? <span className="cab-meta">{r.meta}</span> : null}
          </span>
          {ring ? <span className="cab-ring" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}

function Cabinet({
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
  const cards = momentCards(parts, notes.wellFounded);
  const always = alwaysYours(parts, picks);
  return (
    <div className="cabinet" aria-live="polite">
      {cards.map((c) => (
        <article
          key={`${c.key}-${shaped}`}
          className={`cab-card cab-${c.key}${c.key === 'night' ? ' night' : ''}`}
          aria-label={c.label}
        >
          <div className="cab-top">
            <span className="eyebrow-ink">{c.label}</span>
            <span className={`cab-mark cab-mark-${c.key}`} aria-hidden="true" />
          </div>
          <h2 className="cab-head">{c.title}</h2>
          <Rows rows={c.rows} label={c.label} />
        </article>
      ))}
      {!cards.length && !always.length ? <p className="reveal-empty">{copy.reveal.empty}</p> : null}
      {shaping ? <p className="reveal-shaping">{copy.reveal.shaping}</p> : null}

      {always.length ? (
        <section className="reveal-block" aria-label={copy.reveal.always}>
          <p className="eyebrow-ink">{copy.reveal.always}</p>
          <p className="reveal-always">{listOf(always.map((x, i) => (i ? asSaid(x) : x)))}.</p>
        </section>
      ) : null}

      {notes.letGo.length ? (
        <section className="reveal-block" aria-label={copy.reveal.letGoTitle}>
          <p className="eyebrow-ink">{copy.reveal.letGoTitle}</p>
          <Rows
            label={copy.reveal.letGoTitle}
            ring={false}
            rows={notes.letGo.map((l) => ({
              id: l.name,
              title: l.name,
              meta: l.yearly > 0 ? `${copy.reveal.canGo} · ${copy.reveal.yearBack(money(l.yearly))}` : copy.reveal.canGo,
            }))}
          />
        </section>
      ) : notes.wellFounded.length ? (
        <p className="reveal-block reveal-verdict">{copy.reveal.clean}</p>
      ) : null}

      {notes.worthALook.length ? (
        <section className="reveal-block" aria-label={copy.reveal.worthALookTitle}>
          <p className="reveal-eyebrows">
            <span className="eyebrow-ink">{copy.reveal.worthALookTitle}</span>
            <span className="eyebrow-faint">{copy.reveal.noEvidence}</span>
          </p>
          <Rows
            label={copy.reveal.worthALookTitle}
            ring={false}
            rows={notes.worthALook.map((n) => ({ id: n, title: n, meta: '' }))}
          />
        </section>
      ) : null}
    </div>
  );
}
