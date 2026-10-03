import type { ReactNode } from 'react';
import { OnboardingBar } from '../../components/onboarding-bar';
import { Footer } from '../../components/ui';

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="page">
      <OnboardingBar />
      <main className="main wrap">{children}</main>
      <Footer />
    </div>
  );
}
