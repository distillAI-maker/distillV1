'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { RitualPart } from '@distill/engine/ritual';
import { DBrand } from '../../../components/d-star';
import { useGo } from '../../../components/onboarding/go';
import { RitualSheet } from '../../../components/ritual-sheet';
import { copy } from '../../../lib/copy';
import { revealRitual, shapeRitual } from '../../../lib/engine/preview';
import { alwaysYours, type RevealNotes } from '../../../lib/onboarding/reveal';
import { lifePicks, protectedThing, wakeSaid } from '../../../lib/onboarding/you';
import { useProgress } from '../../../lib/progress/context';

/**
 * Step 5: their first Ritual, as Figma's sheet. The rules version shows at once; when Claude is on,
 * its version (named and paired in their words) replaces it when ready.
 */
export function Reveal() {
  const go = useGo();
  const router = useRouter();
  const { ready, progress } = useProgress();
  const [draft, setDraft] = useState<{ parts: readonly RitualPart[]; notes: RevealNotes } | null>(null);
  const [shaping, setShaping] = useState(false);
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
          if (s) setDraft((d) => (d ? { ...d, parts: s.parts } : d));
        });
      })
      .catch(() => setFailed(true))
      .finally(() => setShaping(false));
  }, [ready, progress]);

  const picks = [...lifePicks(progress), protectedThing(progress)].filter((x): x is string => !!x);
  const notes = draft?.notes;

  return (
    <div className="dapp">
      <div className="d-col">
        <header className="d-ritual-topbar">
          <DBrand />
        </header>
        <main className="d-ritual-scroll" aria-busy={!draft && !failed}>
          {failed ? (
            <p className="d-notice" role="alert">
              {copy.reveal.error}
            </p>
          ) : null}
          <RitualSheet
            name={progress.name.trim().split(/\s+/)[0]}
            wake={wakeSaid(progress)}
            parts={failed ? [] : (draft?.parts ?? null)}
            wellFounded={notes?.wellFounded}
            always={draft ? alwaysYours(draft.parts, picks) : []}
            letGo={notes?.letGo}
            clean={!!notes && !notes.letGo.length && notes.wellFounded.length > 0}
            worthALook={notes?.worthALook}
            note={shaping ? copy.reveal.shaping : null}
            empty={copy.reveal.empty}
          >
            <button type="button" className="d-primary" onClick={() => go('invitation')}>
              {copy.reveal.accept}
              <span aria-hidden="true">→</span>
            </button>
            <button type="button" className="d-ritual-change" onClick={() => router.push('/study')}>
              {copy.app.ritual.change}
            </button>
          </RitualSheet>
        </main>
      </div>
    </div>
  );
}
