import type { ReactNode } from 'react';
import type { RitualPart } from '@distill/engine/ritual';
import { copy } from '../lib/copy';
import { ritualSections } from '../lib/onboarding/reveal';
import { DStar } from './d-star';

const r = copy.app.ritual;
const money = (n: number) => Math.round(n).toLocaleString('en-US');

/**
 * Their Ritual as Figma's sheet: their name, "Your Ritual.", when their morning starts, a section a
 * moment with a time column and a short line a part, what's always theirs, and what's ready to go.
 * The first Ritual at the end of onboarding, and a new draft on Today, both draw it.
 */
export function RitualSheet({
  name,
  wake,
  parts,
  wellFounded = [],
  always = [],
  letGo = [],
  clean = false,
  worthALook = [],
  note,
  empty,
  children,
}: {
  name?: string;
  wake?: string | null;
  parts: readonly RitualPart[] | null;
  wellFounded?: readonly string[];
  always?: readonly string[];
  letGo?: readonly { name: string; yearly: number }[];
  /** Nothing to let go, and some of it well-founded: say so. */
  clean?: boolean;
  worthALook?: readonly string[];
  /** A short line under the sections, such as "Shaping it around you". */
  note?: string | null;
  empty?: string;
  /** The buttons. */
  children?: ReactNode;
}) {
  const sections = parts ? ritualSections(parts, wellFounded) : [];
  return (
    <div className="d-ritual-sheet">
      <header className="d-ritual-header">
        {name ? <p className="d-ritual-name-line">{name}</p> : null}
        <h1 className="d-ritual-title">
          {r.titleStart}
          <br />
          <em>{r.titleEnd}</em>
        </h1>
        <p className="d-ritual-subtitle">{r.subtitle}</p>
      </header>

      {wake ? (
        <div className="d-ritual-wake">
          <span className="d-ritual-wake__time">{wake}</span>
          <span className="d-ritual-wake__label">{r.wakes}</span>
        </div>
      ) : null}

      {!parts ? (
        <div className="d-wait" aria-busy="true">
          <span className="d-wait__line" />
          <span className="d-wait__line" />
          <span className="d-wait__line" />
        </div>
      ) : null}

      <div aria-live="polite">
        {sections.map((s) => (
          <section key={s.key} className="d-ritual-section" aria-label={s.label}>
            <h2 className="d-ritual-section__label">{s.label}</h2>
            <ul className="d-ritual-items">
              {s.rows.map((row) => (
                <li key={row.id} className={`d-ritual-item${row.yours ? ' d-ritual-item--yours' : ''}`}>
                  <span className={`d-ritual-item__time${row.time.days ? ' d-ritual-item__time--days' : ''}`}>
                    {row.time.lines.map((l, i) => (
                      <span key={i} style={{ display: 'block' }}>
                        {l}
                      </span>
                    ))}
                  </span>
                  <div className="d-ritual-item__body">
                    <p className="d-ritual-item__name">
                      {row.title}
                      {row.yours ? <DStar size="tiny" /> : null}
                    </p>
                    {row.why ? <p className="d-ritual-item__why">{row.why}</p> : null}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {parts && !sections.length && !always.length && empty ? <p className="d-letgo-intro">{empty}</p> : null}
        {note ? <p className="d-ritual-footnote d-ritual-note">{note}</p> : null}
      </div>

      {always.length ? (
        <section className="d-ritual-section" aria-label={r.always}>
          <h2 className="d-ritual-section__label">{r.always}</h2>
          <ul className="d-protected-pills">
            {always.map((a) => (
              <li key={a} className="d-protected-pill">
                <DStar size="tiny" />
                {a}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {letGo.length ? (
        <section className="d-ritual-section d-ritual-section--letgo" aria-label={r.letGo}>
          <h2 className="d-ritual-section__label">{r.letGo}</h2>
          <ul className="d-letgo-items">
            {letGo.map((l) => (
              <li key={l.name} className="d-letgo-item">
                <span className="d-letgo-item__name">{l.name}</span>
                {l.yearly > 0 ? <span className="d-letgo-item__money">{r.yearBack(money(l.yearly))}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : clean ? (
        <p className="d-ritual-section d-ritual-clean">{copy.reveal.clean}</p>
      ) : null}

      {worthALook.length ? (
        <section className="d-ritual-section" aria-label={r.worthALook}>
          <h2 className="d-ritual-section__label">{r.worthALook}</h2>
          <p className="d-letgo-intro">{r.noEvidence}</p>
          <ul className="d-letgo-items">
            {worthALook.map((n) => (
              <li key={n} className="d-letgo-item">
                <span className="d-e-item__name">{n}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {children ? <div className="d-ritual-ctas">{children}</div> : null}
      <p className="d-ritual-footnote">{r.footnote}</p>
    </div>
  );
}
