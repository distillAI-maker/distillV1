import type { ReactNode } from 'react';
import { BackProvider } from '../../components/back-handler';
import { OnboardingBar } from '../../components/onboarding-bar';
import { StepNumberProvider } from '../../components/onboarding/step-number';

/** Onboarding, in the design system: the bar, then the screen, in a phone-width column. */
export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="ds">
      <div className="ds-col">
        <BackProvider>
          <StepNumberProvider>
            <OnboardingBar />
            <main className="ob-main">{children}</main>
          </StepNumberProvider>
        </BackProvider>
      </div>
    </div>
  );
}
