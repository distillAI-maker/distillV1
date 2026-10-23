/**
 * The onboarding steps, in order (Veer, 22 Oct): their name, then seven steps to their first Ritual.
 * Tap what you do and add what we missed (both on /stack), the number, who you are at your best,
 * what makes you you, the reveal, and the invitation with connect. Arrival is '/'.
 */
export const onboardingSteps = [
  'name',
  'stack',
  'number',
  'best',
  'yours',
  'reveal',
  'invitation',
  'connect',
] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

/** The seven numbered steps the bar counts. The name comes first and isn't numbered. */
export const NUMBERED_STEPS = 7;
const stepNumbers: Record<OnboardingStep, number | null> = {
  name: null,
  // "Anything we missed" is step 2 on the same page; the stack screen says so (useStepNumber).
  stack: 1,
  number: 3,
  best: 4,
  yours: 5,
  reveal: 6,
  invitation: 7,
  connect: 7,
};

export function stepNumber(step: OnboardingStep): number | null {
  return stepNumbers[step];
}

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
  // Older saves: the ideal day and the goals became "You, at your best"; the questions resume at
  // the number; the sort and the day-one screens at the invitation.
  if (step === 'life' || step === 'goals') return '/best';
  if (step === 'questions') return '/number';
  if (['heard', 'sorted', 'ready', 'day-one'].includes(step)) return '/invitation';
  return (onboardingSteps as readonly string[]).includes(step) ? `/${step}` : '/stack';
}
