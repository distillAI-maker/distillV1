'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { copy } from '../../lib/copy';
import { useProgress } from '../../lib/progress/context';
import { resumePath } from '../../lib/steps';
import { Mark } from './mark';

/**
 * The first screen: "Distill" settles, then the sentence completes. Tap, Enter or Space moves on;
 * otherwise it moves on by itself. Someone with saved progress picks up where they left off.
 */
export function Arrival({ signInFirst }: { signInFirst: boolean }) {
  const router = useRouter();
  const { ready, progress } = useProgress();
  const [phase, setPhase] = useState(0);
  const left = useRef(false);

  const next = useCallback(() => {
    if (left.current) return;
    left.current = true;
    const started = progress.items.length > 0 || progress.step !== 'stack';
    router.push(started ? resumePath(progress.step) : signInFirst ? '/sign-in' : '/stack');
  }, [progress.items.length, progress.step, router, signInFirst]);

  useEffect(() => {
    const reveal = window.setTimeout(() => setPhase(1), 1600);
    return () => window.clearTimeout(reveal);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const advance = window.setTimeout(next, 6800);
    return () => window.clearTimeout(advance);
  }, [ready, next]);

  return (
    <main
      className={`arrival phase-${phase}`}
      onClick={next}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          next();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={copy.welcome.tapToBegin}
    >
      <div className="arrival-glow" aria-hidden="true" />
      <div className="arrival-mark" aria-hidden="true">
        <Mark />
      </div>
      <h1 className="arrival-copy">
        <span className="arrival-distill">Distill</span>
        <span className="arrival-rest">your life.</span>
      </h1>
      <p className="arrival-note">{copy.welcome.line}</p>
    </main>
  );
}
