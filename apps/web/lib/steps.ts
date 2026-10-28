/**
 * The onboarding steps, in order (Veer, 23 Oct): their name, then six steps to their first Ritual.
 * Tap what you do and add what we missed (both on /stack), the number, the private study (six taps
 * and the read, on /study), the reveal, and the invitation with connect. Arrival is '/'.
 */
export const onboardingSteps = [
  'name',
  'stack',
  'number',
  'study',
  'reveal',
  'invitation',
  'connect',
] as const;
export type OnboardingStep = (typeof onboardingSteps)[number];

/** The six numbered steps the bar counts. The name comes first and isn't numbered. */
export const NUMBERED_STEPS = 6;
const stepNumbers: Record<OnboardingStep, number | null> = {
  name: null,
  // "Anything we missed" is step 2 on the same page; the stack screen says so (useStepNumber).
  stack: 1,
  number: 3,
  // The study draws its own header with its own seven-part progress.
  study: 4,
  reveal: 5,
  invitation: 6,
  connect: 6,
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

/** Where people land once onboarding is done: their Ritual. */
export const RITUAL_HOME = '/today';

/** Where a saved person picks up: the step they reached, or the app once onboarding is done. */
export function resumePath(step: string): string {
  if (step === 'done') return RITUAL_HOME;
  // Older saves: the ideal day, the goals, "at your best" and "what makes you you" all became the
  // study; the questions resume at the number; the sort and the day-one screens at the invitation.
  if (['life', 'goals', 'best', 'yours'].includes(step)) return '/study';
  if (step === 'questions') return '/number';
  if (['heard', 'sorted', 'ready', 'day-one'].includes(step)) return '/invitation';
  return (onboardingSteps as readonly string[]).includes(step) ? `/${step}` : '/stack';
}

/** Older pages that still answer at their address, and the step that comes before each. */
const olderPrevious: Record<string, OnboardingStep> = {
  questions: 'number',
  sorted: 'study',
  ready: 'reveal',
  life: 'number',
  best: 'number',
  yours: 'number',
};

/**
 * Where Back goes from a path: the step before it, never the opener unless this is the first step.
 * A page inside a step (/connect/import) goes back to that step's own page.
 */
export function backFrom(pathname: string | null): string {
  const parts = (pathname ?? '').split('/').filter(Boolean);
  const first = parts[0] ?? '';
  const step = onboardingSteps.find((s) => s === first);
  if (step && parts.length > 1) return `/${step}`;
  if (step) {
    const i = onboardingSteps.indexOf(step);
    return i > 0 ? `/${onboardingSteps[i - 1]}` : '/';
  }
  const older = olderPrevious[first];
  return older ? `/${older}` : '/';
}
