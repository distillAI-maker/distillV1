'use client';

import { usePathname, useRouter } from 'next/navigation';
import type { CSSProperties } from 'react';
import { copy } from '../lib/copy';
import { onboardingSteps, stepForPath } from '../lib/steps';
import { BackButton, Wordmark } from './ui';

/** The bar above every onboarding screen: back, wordmark, "k of 5", and the progress line. */
export function OnboardingBar() {
  const pathname = usePathname();
  const router = useRouter();
  const step = stepForPath(pathname);
  const index = step ? onboardingSteps.indexOf(step) : -1;
  const total = onboardingSteps.length;
  const current = index + 1;
  const previous = index > 0 ? onboardingSteps[index - 1] : undefined;
  const backHref = previous ? `/${previous}` : '/';
  return (
    <header className="obar">
      <div className="wrap">
        <BackButton
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push(backHref);
          }}
        />
        <Wordmark />
        <span className="step" aria-label={copy.common.stepOf(current, total)}>
          {current} / {total}
        </span>
      </div>
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
    </header>
  );
}
