'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { CSSProperties } from 'react';
import { copy } from '../lib/copy';
import { NUMBERED_STEPS, onboardingSteps, stepForPath, stepNumber } from '../lib/steps';
import { useBack } from './back-handler';
import { useStepOverride } from './onboarding/step-number';
import { BackButton, Wordmark } from './ui';

/** The bar above every onboarding screen: back, wordmark, the step as "02" of seven, and the progress line. The name screen shows only back and the wordmark. */
export function OnboardingBar() {
  const pathname = usePathname();
  const router = useRouter();
  const takeover = useBack();
  const override = useStepOverride();
  // Each step starts at the top, under the bar, whatever the last screen's scroll position was.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  const step = stepForPath(pathname);
  const index = step ? onboardingSteps.indexOf(step) : -1;
  const total = NUMBERED_STEPS;
  const current = override ?? (step ? stepNumber(step) : null);
  const previous = index > 0 ? onboardingSteps[index - 1] : undefined;
  const backHref = previous ? `/${previous}` : '/';
  const bare = current === null;
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
