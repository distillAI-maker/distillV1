/**
 * Every user-facing string in the app lives here, so one test can run toneLint over all of them.
 * Second person, under 60 words, no exclamation marks, nothing about the person. See
 * docs/ONBOARDING.md section 5 for the screen each string belongs to.
 */
export const copy = {
  common: {
    appName: 'Distill',
    back: 'Back',
    continue: 'Continue',
    tryAgain: 'Try again',
    progressLabel: 'Onboarding progress',
    stepOf: (k: number, n: number) => `Step ${k} of ${n}`,
    footerNav: 'Footer',
    disclaimer:
      'Distill is a wellness tool for self-reported goals and self-owned data. It is not a medical product and nothing here is medical advice. If a clinician prescribed or recommended something, keep taking it and talk to them before changing it.',
    savedOnDevice: 'Saved on this device only.',
    loading: 'Loading',
  },
  welcome: {
    title: 'Distill your life.',
    line: 'Everything you take, buy and do for sleep and recovery, read against your own nights.',
    begin: 'Begin',
    haveAccount: 'I already have an account',
  },
  signIn: {
    title: 'Where can we send your link?',
    line: 'No password. We email you a link that signs you in.',
    emailLabel: 'Email',
    send: 'Send my link',
    sentTitle: 'Check your email.',
    sentLine: 'The link is good for an hour. Open it on this device to carry on.',
    sendAgain: 'Send it again',
    differentAddress: 'Use a different address',
    errorSend: "We couldn't send the link. Check the address and try again.",
    errorRate: "That's a lot of links in a short time. Give it a few minutes.",
    errorInvalid: 'That address does not look right. Check it and try again.',
    signingIn: 'Signing you in',
    expiredTitle: 'That link has expired or was already used.',
    sendNew: 'Send a new link',
    noAccountsTitle: 'No account needed in this build.',
    noAccountsLine: 'Your progress is saved on this device.',
    beginWithout: 'Begin without an account',
  },
  connect: {
    title: 'Where do your nights come from?',
    line: 'Distill reads sleep and recovery from the wearable you already own. Nothing to log by hand.',
    oura: 'Oura',
    whoop: 'WHOOP',
    fitbit: 'Fitbit',
    apple: 'Apple Health export',
    appleHint: 'Upload export.zip',
    appleHow: 'How to export from the Health app',
    demo: 'Use demo data',
    demoLine: 'A made-up person with six months of nights and a 21-item stack. Nothing here is yours yet.',
    unavailable: 'Not yet connected in this build.',
    backfillTitle: 'Reading your history.',
    backfillCount: (n: number) => `${n} nights so far`,
    backfillDone: 'Six months of nights, ready.',
    errorStart: "We couldn't start that connection. Try again, or use demo data for now.",
    errorFile: "We couldn't read that file. Pick the export.zip the Health app made.",
  },
  stack: {
    title: "What's in your stack?",
    line: "Everything you take, buy or do for sleep, recovery and how you look. Search below, or write it out and we'll match what we can.",
    done: "That's everything",
  },
} as const;

type Leaf = string | ((...args: never[]) => string);
type Tree = { [k: string]: Leaf | Tree };

/** Every string in the tree, with functions sampled once, for the tone test. */
export function allStrings(tree: Tree = copy as unknown as Tree, path = ''): [string, string][] {
  const out: [string, string][] = [];
  for (const [key, value] of Object.entries(tree)) {
    const at = path ? `${path}.${key}` : key;
    if (typeof value === 'string') out.push([at, value]);
    else if (typeof value === 'function') out.push([at, sample(value)]);
    else out.push(...allStrings(value, at));
  }
  return out;
}
function sample(fn: Leaf): string {
  if (typeof fn === 'string') return fn;
  const f = fn as (...args: unknown[]) => string;
  return f(3, 5);
}
