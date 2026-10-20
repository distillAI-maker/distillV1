'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { copy } from '../../lib/copy';
import { useProgress } from '../../lib/progress/context';
import { resumePath } from '../../lib/steps';
import { track } from '../../lib/track';
import { Mark } from './mark';

/**
 * The first screen, as the brand board's mobile landing: one cinematic image, one line, Begin.
 * Tap, Enter or Space moves on. Someone with saved progress picks up where they left off; anyone new
 * gives their name next. The email comes at the invitation, once there is something to keep.
 */
export function Arrival() {
  const router = useRouter();
  const { ready, progress } = useProgress();
  const [phase, setPhase] = useState(0);
  const left = useRef(false);

  const started =
    progress.items.length > 0 || (progress.step !== 'stack' && progress.step !== 'name');
  const next = useCallback(() => {
    if (left.current) return;
    left.current = true;
    router.push(started ? resumePath(progress.step) : '/name');
  }, [started, progress.step, router]);

  useEffect(() => {
    track('arrived');
    const reveal = window.setTimeout(() => setPhase(1), 300);
    return () => window.clearTimeout(reveal);
  }, []);

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
      <div className="arrival-img" aria-hidden="true" />
      <div className="arrival-top">
        <span className="wordmark wordmark-light" translate="no">
          <Mark />
          <span>Distill</span>
        </span>
      </div>
      <div className="arrival-body">
        <p className="label">{copy.welcome.kicker}</p>
        <h1 className="arrival-copy">
          {copy.welcome.titleStart} <i>{copy.welcome.titleEnd}</i>
        </h1>
        <p className="arrival-line">{copy.welcome.line}</p>
        <span className="btn btn-light btn-block arrival-begin" aria-hidden="true">
          {ready && started ? copy.welcome.resume : copy.welcome.begin}
          <span>→</span>
        </span>
      </div>
      <div className="arrival-foot" aria-hidden="true">
        <span>Morning — 06:45</span>
        <Mark />
        <span>Night — 21:40</span>
      </div>
    </main>
  );
}
