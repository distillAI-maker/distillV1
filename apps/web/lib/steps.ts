/**
 * The onboarding steps, in order: intake and one moment (docs/DIRECTION.md). The questions, the
 * sort and what can go happen in the app, over days, not here. Arrival is '/'.
 */
export const onboardingSteps = [
  'name',
  'stack',
  'life',
  'number',
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

/** Where a saved person picks up: the step they reached, or the app once onboarding is done. */
export function resumePath(step: string): string {
  if (step === 'done') return '/home';
  // Older saves from the longer flow: the questions resume at the number, the sort at the invitation.
  if (step === 'goals' || step === 'questions') return step === 'goals' ? '/life' : '/number';
  if (['heard', 'sorted', 'ready', 'day-one'].includes(step)) return '/invitation';
  return (onboardingSteps as readonly string[]).includes(step) ? `/${step}` : '/stack';
}
