'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { copy } from '../lib/copy';
import { backFrom, NUMBERED_STEPS, stepForPath, stepNumber } from '../lib/steps';
import { useBack } from './back-handler';
import { useStepOverride } from './onboarding/step-number';

/**
 * The bar above every onboarding screen, as the prototype draws it: Back on the left, "01 of 06" on
 * the right, and a thin spark line for how far they've come. The name isn't a numbered step, so it
 * shows Back alone. Back always goes to the step before (lib/steps.ts, backFrom).
 */
export function OnboardingBar() {
  const pathname = usePathname();
  const router = useRouter();
  const takeover = useBack();
  const override = useStepOverride();
  // Each step starts at the top, whatever the last screen's scroll position was.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);
  const step = stepForPath(pathname);
  const current = override ?? (step ? stepNumber(step) : null);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <header className="ob-progress">
      <div className="ob-progress-row">
        <button
          type="button"
          className="ob-back"
          onClick={() => {
            if (takeover && takeover()) return;
            router.push(backFrom(pathname));
          }}
        >
          {copy.common.back}
        </button>
        {current === null ? null : (
          <span aria-label={copy.common.stepOf(current, NUMBERED_STEPS)}>
            {pad(current)} of {pad(NUMBERED_STEPS)}
          </span>
        )}
      </div>
      {current === null ? null : (
        <span
          className="ob-line"
          role="progressbar"
          aria-label={copy.common.progressLabel}
          aria-valuemin={0}
          aria-valuemax={NUMBERED_STEPS}
          aria-valuenow={current}
        >
          <i style={{ width: `${(current / NUMBERED_STEPS) * 100}%` }} />
        </span>
      )}
    </header>
  );
}
