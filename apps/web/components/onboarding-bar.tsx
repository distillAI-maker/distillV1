'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { copy } from '../lib/copy';
import { onboardingSteps, stepForPath } from '../lib/steps';
import { useBack } from './back-handler';
import { BackButton, Wordmark } from './ui';

/** The bar above every onboarding screen: back, wordmark, the step as "02", and the progress line. The name screen shows only back and the wordmark. */
export function OnboardingBar() {
  const pathname = usePathname();
  const router = useRouter();
  const takeover = useBack();
  // Each step starts at the top, under the bar, whatever the last screen's scroll position was.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  const step = stepForPath(pathname);
  const index = step ? onboardingSteps.indexOf(step) : -1;
  const total = onboardingSteps.length;
  const current = index + 1;
  const previous = index > 0 ? onboardingSteps[index - 1] : undefined;
  const backHref = previous ? `/${previous}` : '/';
  const bare = step === 'name';
  return (
    <header className="obar">
      <div className="wrap">
        <BackButton
          onClick={() => {
            if (takeover && takeover()) return;
            router.push(backHref);
          }}
        />
        <Wordmark />
        {bare ? (
          <span />
        ) : (
          <span className="step num" aria-label={copy.common.stepOf(current, total)}>
            {String(current).padStart(2, '0')}
          </span>
        )}
      </div>
      {bare ? null : (
        <div
          className="progress"
          role="progressbar"
          aria-label={copy.common.progressLabel}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={current}
        >
          <i style={{ '--w': `${(current / total) * 100}%` } as CSSProperties} />
        </div>
      )}
    </header>
  );
}
