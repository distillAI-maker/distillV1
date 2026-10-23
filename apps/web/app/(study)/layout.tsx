import type { ReactNode } from 'react';

/** The private study draws its own header and fills the screen, so it sits outside the onboarding bar. */
export default function StudyLayout({ children }: { children: ReactNode }) {
  return children;
}
