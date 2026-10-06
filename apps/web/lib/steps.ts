/** The onboarding steps, in order. The progress line counts exactly these. Arrival is '/'. */
export const onboardingSteps = [
  'stack',
  'life',
  'questions',
  'number',
  'heard',
  'sorted',
  'ready',
  'invitation',
  'connect',
] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

export function stepForPath(pathname: string | null): OnboardingStep | undefined {
  const first = (pathname ?? '').split('/').filter(Boolean)[0];
  return onboardingSteps.find((s) => s === first);
}

export function nextStep(step: OnboardingStep): OnboardingStep | 'done' {
  const i = onboardingSteps.indexOf(step);
  return onboardingSteps[i + 1] ?? 'done';
}

/** Where a saved person picks up: the step they reached, or Today once onboarding is done. */
export function resumePath(step: string): string {
  if (step === 'done') return '/today';
  if (step === 'goals') return '/life';
  if (step === 'day-one') return '/sorted';
  return (onboardingSteps as readonly string[]).includes(step) ? `/${step}` : '/stack';
}
