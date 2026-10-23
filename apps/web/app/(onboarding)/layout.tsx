import type { ReactNode } from 'react';
import { BackProvider } from '../../components/back-handler';
import { OnboardingBar } from '../../components/onboarding-bar';
import { Ground } from '../../components/onboarding/ground';
import { OnboardingFoot } from '../../components/onboarding/onboarding-foot';
import { StepNumberProvider } from '../../components/onboarding/step-number';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <BackProvider>
      <StepNumberProvider>
        <Ground />
        <div className="page">
          <OnboardingBar />
          <main className="main wrap">{children}</main>
          <OnboardingFoot />
        </div>
      </StepNumberProvider>
    </BackProvider>
  );
}
