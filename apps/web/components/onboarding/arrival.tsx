'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { copy } from '../../lib/copy';
import { useProgress } from '../../lib/progress/context';
import { resumePath } from '../../lib/steps';
import { track } from '../../lib/track';
import { Arrow, Brand } from '../ds/ui';

/**
 * The first screen opens on the problem, still and calm (Veer, 28 Oct: no noise animation):
 * "There's so much noise. Doing everything wears you down." Begin goes to the name; someone with
 * saved progress picks up where they left off. A quiet link signs in an existing account. Anyone
 * already through onboarding, or signed in partway, goes straight back to where they were.
 */
export function Arrival() {
  const router = useRouter();
  const { ready, progress, store } = useProgress();
  const left = useRef(false);

  const started =
    progress.items.length > 0 || (progress.step !== 'stack' && progress.step !== 'name');

  useEffect(() => {
    track('arrived');
  }, []);

  // Someone already through onboarding (or signed in mid-way, from the email link) goes straight
  // back in: the opener is for arriving, not for every open.
  const straightIn = ready && (progress.step === 'done' || (store.id === 'supabase' && started));
  useEffect(() => {
    if (!straightIn || left.current) return;
    left.current = true;
    router.replace(resumePath(progress.step));
  }, [straightIn, progress.step, router]);

  const begin = () => {
    if (left.current) return;
    left.current = true;
    router.push(ready && started ? resumePath(progress.step) : '/name');
  };

  if (straightIn) return <div className="ds" aria-busy="true" />;

  return (
    <div className="ds">
      <div className="ds-col">
        <main className="ob-opener">
          <Brand light />
          <section className="ob-opener-copy">
            <h1>
              {copy.welcome.title} {copy.welcome.titleEnd}
            </h1>
            <p>{copy.welcome.line}</p>
          </section>
          <div className="ob-opener-actions">
            <button type="button" className="ds-primary ds-primary--light" onClick={begin}>
              {ready && started ? copy.welcome.resume : copy.welcome.begin}
              <Arrow />
            </button>
            <button type="button" className="ds-link" onClick={() => router.push('/sign-in')}>
              {copy.welcome.haveAccount}
            </button>
          </div>
          <div className="ob-time-range" aria-hidden="true">
            <span>Morning 06:45</span>
            <i />
            <span>Night 21:40</span>
          </div>
        </main>
      </div>
    </div>
  );
}
