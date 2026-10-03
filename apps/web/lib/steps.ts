/** The five onboarding steps, in order. The progress line counts exactly these. */
export const onboardingSteps = ['connect', 'stack', 'goals', 'questions', 'day-one'] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

export function stepForPath(pathname: string | null): OnboardingStep | undefined {
  const first = (pathname ?? '').split('/').filter(Boolean)[0];
  return onboardingSteps.find((s) => s === first);
}

export function nextStep(step: OnboardingStep): OnboardingStep | 'done' {
  const i = onboardingSteps.indexOf(step);
  return onboardingSteps[i + 1] ?? 'done';
}
