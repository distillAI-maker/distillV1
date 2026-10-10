import type { ReactNode } from 'react';
import { BackProvider } from '../../components/back-handler';
import { OnboardingBar } from '../../components/onboarding-bar';
import { Ground } from '../../components/onboarding/ground';
import { OnboardingFoot } from '../../components/onboarding/onboarding-foot';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <BackProvider>
      <Ground />
      <div className="page">
        <OnboardingBar />
        <main className="main wrap">{children}</main>
        <OnboardingFoot />
      </div>
    </BackProvider>
  );
}
