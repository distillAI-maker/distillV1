'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { copy } from '../../lib/copy';
import { useProgress } from '../../lib/progress/context';
import { resumePath } from '../../lib/steps';
import { track } from '../../lib/track';
import { Mark } from './mark';

/**
 * The first screen opens on the problem. The feed's words are thrown at the screen, faster and
 * faster, until it's too much; a small jolt, then they rush past and blur away, the quiet image comes up, and the line lands: "There's so much noise. Doing
 * everything wears you down." A tap during the noise skips to the line; a tap on the line begins.
 * People with saved progress, and anyone who asked for less motion, land on the line directly.
 */

type Phase = 'idle' | 'noise' | 'clear' | 'settled';

/** When the noise clears and when the line lands, in ms. */
const CLEAR_AT = 2000;
const SETTLE_AT = 2600;
/** The noise piles up over this long: a few words, then a rush. */
const PILE_MS = 1300;

/**
 * Where each word of the noise sits: three loose columns down the whole screen, each word pushed
 * well off its cell so they crowd and overlap, and the cells filled in a scattered order so the
 * noise builds everywhere at once. A few large serif words, more small ones, and spaced capitals
 * like tags. Fixed, so the server and the browser draw the same thing.
 */
const COLS = 3;
const ROWS = Math.ceil(copy.welcome.noise.length / COLS);
const words = copy.welcome.noise.map((text, i) => {
  const frac = (n: number) => n - Math.floor(n);
  const cell = (i * 17) % (ROWS * COLS);
  const row = Math.floor(cell / COLS);
  const col = cell % COLS;
  const tier = i % 7 === 0 ? 'lg' : i % 3 === 0 ? 'tag' : i % 2 === 0 ? 'md' : 'sm';
  return {
    text,
    tier,
    style: {
      '--x': `${20 + col * 30 + (frac(i * 0.754) - 0.5) * 30}%`,
      '--y': `${5 + (row + 0.5) * (88 / ROWS) + (frac(i * 0.618) - 0.5) * 4}%`,
      // Gaps shrink as it goes ((i/n)^0.6), so it starts sparse and ends in a rush.
      '--d': `${Math.round(PILE_MS * (i / copy.welcome.noise.length) ** 0.6)}ms`,
      '--o': `${0.2 + frac(i * 0.7548) * 0.45}`,
      // How far off the screen each word is thrown from: 2.2 to 3.4 times its size.
      '--s': `${(2.2 + frac(i * 0.381) * 1.2).toFixed(2)}`,
    } as CSSProperties,
  };
});

export function Arrival() {
  const router = useRouter();
  const { ready, progress } = useProgress();
  const [phase, setPhase] = useState<Phase>('idle');
  const left = useRef(false);

  const started =
    progress.items.length > 0 || (progress.step !== 'stack' && progress.step !== 'name');

  useEffect(() => {
    track('arrived');
  }, []);

  // Decide once progress has loaded: the noise for someone new, the line for everyone else.
  useEffect(() => {
    if (!ready || phase !== 'idle') return;
    const still =
      progress.reducedMotion ||
      document.documentElement.dataset.motion === 'reduce' ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (started || still) {
      setPhase('settled');
      return;
    }
    setPhase('noise');
  }, [ready, phase, started, progress.reducedMotion]);

  // Each phase schedules the next, so a skip (a tap) simply replaces what was scheduled.
  useEffect(() => {
    if (phase !== 'noise' && phase !== 'clear') return;
    const t =
      phase === 'noise'
        ? window.setTimeout(() => setPhase('clear'), CLEAR_AT)
        : window.setTimeout(() => setPhase('settled'), SETTLE_AT - CLEAR_AT);
    return () => window.clearTimeout(t);
  }, [phase]);

  const next = useCallback(() => {
    if (phase !== 'settled') {
      setPhase('settled');
      return;
    }
    if (left.current) return;
    left.current = true;
    router.push(started ? resumePath(progress.step) : '/name');
  }, [phase, started, progress.step, router]);

  return (
    <main
      className={`arrival is-${phase}`}
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
      <div className="arrival-noise" aria-hidden="true">
        {words.map((w) => (
          <span key={w.text} className={`noise-${w.tier}`} style={w.style}>
            {w.text}
          </span>
        ))}
      </div>
      <div className="arrival-top">
        <span className="wordmark wordmark-light" translate="no">
          <Mark />
          <span>Distill</span>
        </span>
      </div>
      <div className="arrival-body">
        <h1 className="arrival-copy">
          {copy.welcome.title} <i>{copy.welcome.titleEnd}</i>
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
