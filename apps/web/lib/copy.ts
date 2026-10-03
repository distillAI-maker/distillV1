import type { AskableField } from './followups/fields';

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
    cancel: 'Cancel',
    progressLabel: 'Onboarding progress',
    stepOf: (k: number, n: number) => `Step ${k} of ${n}`,
    footerNav: 'Footer',
    disclaimer:
      'Distill is a wellness tool for self-reported goals and self-owned data. It is not a medical product and nothing here is medical advice. If a clinician prescribed or recommended something, keep taking it and talk to them before changing it.',
    savedOnDevice: 'Saved on this device only.',
    loading: 'Loading',
    yes: 'Yes',
    no: 'No',
    notSure: 'Not sure',
    pickOne: 'Pick one to go on.',
    enterNumber: 'Type a number to go on.',
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
    demoLine:
      'A made-up person with six months of nights and a 21-item stack. Nothing here is yours yet.',
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
    searchLabel: 'Search 210 things',
    searchPlaceholder: 'Try magnesium, Equinox, cold plunge',
    resultsLabel: 'Matches',
    noMatch: 'Nothing in the list matches that.',
    listedTag: 'Already listed',
    addAsCustom: (q: string) => `Add "${q}" as something not listed`,
    scratchToggle: 'Or write it out',
    scratchLabel: 'Notes',
    scratchPlaceholder: 'I go to Equinox, take AG1 most mornings, do Pilates twice a week.',
    scratchHint: "We match what we recognise as you type. Anything else stays in your notes.",
    addMatch: (name: string) => `Add ${name}`,
    addCustom: 'Add something not listed',
    customName: 'What is it?',
    customCost: 'a month',
    customNote: "We'll count the cost. Reading it comes later.",
    addIt: 'Add it',
    costLabel: 'a month',
    costFor: (name: string) => `Monthly cost of ${name}`,
    originLabel: 'Where did it come from?',
    originFor: (name: string) => `Where ${name} came from`,
    origins: {
      doctor: 'Doctor',
      'blood test': 'Blood test',
      friend: 'Friend',
      podcast: 'Podcast',
      online: 'Online',
      other: 'Other',
    },
    protectedTag: 'Protected',
    dataSourceTag: 'Your data source',
    remove: (name: string) => `Remove ${name}`,
    total: (n: number, dollars: string) => `${n} things · $${dollars} a month`,
    totalOne: (dollars: string) => `1 thing · $${dollars} a month`,
    done: "That's everything",
    needOne: 'Add at least one thing to go on.',
    demoLine: 'Prefilled from the demo person. Change anything.',
    categories: {
      supplement: 'Supplements',
      'food/drink': 'Food and drink',
      timing: 'Timing',
      habit: 'Habits',
      device: 'Devices',
      service: 'Services',
      environment: 'Environment',
      skincare: 'Skincare',
      custom: 'Not listed',
    },
  },
  goals: {
    title: 'What are you hoping to change?',
    line: 'Pick as many as fit. "Nothing specific" is a real answer.',
    continue: 'Continue',
  },
  questions: {
    count: (k: number, n: number) => `Question ${k} of ${n}`,
    reading: 'Reading your stack',
    errorLoad: "We couldn't load your items. Nothing was lost.",
    thatsRight: "That's right",
    changeIt: 'Change it',
    readFrom: (source: string) => `We read this from your ${source}.`,
    exactLine: 'The answer you picked sits on the line this one is read on, so the exact number matters.',
    doseLine: 'The label on the bottle has the number.',
    doseServingLine: 'The label gives it per serving; we add it up for the day.',
    dailyTotal: (n: string, unit: string) => `${n} ${unit}`,
    formLine: 'The label on the bottle says.',
    goalLine: "Pick the goal you'd judge it by.",
    pickedChip: (label: string) => `You picked ${label}.`,
    fields: {
      goal: { q: "What's this one for?" },
      dose: { q: 'How much a day?' },
      doseUnit: { q: 'How much a day?' },
      form: { q: 'Which form?' },
      time: { q: 'What time, usually?' },
      onMedication: {
        q: 'Are you on any prescription medication?',
        line: 'Some things interact, and that is a question for a clinician, not an app.',
      },
      onAntidepressant: {
        q: 'Are you on an antidepressant?',
        line: 'Some things interact, and that is a question for a clinician, not an app.',
      },
      diabetes: { q: 'Do you have diabetes?' },
      prediabetes: { q: 'Has a clinician mentioned prediabetes?' },
      alcoholMostNights: { q: 'Do you drink most nights?' },
      liverCondition: { q: 'Any liver condition you know of?' },
      vegan: { q: 'Are you vegan?' },
      vegetarian: { q: 'Are you vegetarian?' },
      age: { q: 'How old are you?', line: 'Only for this one item; it changes what the studies say.' },
      onMetformin: { q: 'Are you on metformin?' },
      onAcidReducers: { q: 'Do you take an acid reducer, like omeprazole?' },
      deficiency: { q: 'Has a blood test shown you low in it?' },
      namedProblem: {
        q: 'Did you start it for a specific problem?',
        line: 'A named strain for a named reason is a different thing from a daily habit.',
      },
      trainingMinutesPerDay: { q: 'How many minutes a day do you train?' },
      keto: { q: 'Are you on a keto diet?' },
      stillPaying: { q: 'Still paying for it?' },
      cupsPerDay: { q: 'How many cups a day?', exact: 'How many cups, exactly?' },
      nightsPerWeek: { q: 'How many nights a week, usually?', exact: 'How many nights a week, exactly?' },
      dinnerToBedMinutes: {
        q: 'How long between dinner and bed, usually?',
        exact: 'About how many minutes between dinner and bed?',
      },
      bathroomNightsPerWeek: {
        q: 'How many nights a week do you get up for the bathroom?',
        exact: 'How many nights, exactly?',
      },
      vigorous: { q: 'Are those sessions hard ones?', line: 'Hard means out of breath, not a stroll.' },
      workoutToBedMinutes: { q: 'About how many minutes between the end of a session and bed?' },
      workoutEndHour: { q: 'When do your sessions usually end?', exact: 'What hour does it end, 0 to 23?' },
      workoutNightsPerWeek: { q: 'How many evenings a week?' },
      daysSinceLastUse: { q: 'When did you last use it?', exact: 'About how many days ago?' },
      lastUsed: { q: 'When did you last use it?', exact: 'About how many days ago?' },
      phoneNightsPerWeek: {
        q: 'How many nights a week is the phone in bed?',
        exact: 'How many nights, exactly?',
      },
      wakeSpreadMinutes: { q: 'How much does your wake time move from day to day?' },
      weekendDelayMinutes: { q: 'How much later do you wake at the weekend?' },
      napHour: { q: 'What time do you usually nap?' },
      napMinutes: { q: 'How long, usually?' },
      napDaysPerWeek: { q: 'How many days a week?' },
      snores: { q: 'Do you snore?', line: 'Someone else usually knows.' },
      possibleSleepApnoea: { q: 'Has anyone raised sleep apnoea with you?' },
      gaspingOrChoking: { q: 'Do you wake gasping or choking?' },
      comfortableNasalBreathing: { q: 'Can you breathe comfortably through your nose?' },
      blockedNose: { q: 'Is your nose often blocked at night?' },
      noisyRoom: { q: 'Is the room noisy at night?' },
      snoringPartner: { q: 'Does a partner snore?' },
      blackedOutRoom: { q: 'Is the room fully dark?' },
      sleepsHot: { q: 'Do you sleep hot?' },
      allergies: { q: 'Do you have allergies?' },
      heavyTraffic: { q: 'Heavy traffic or city air outside?' },
      visitsLast30Days: { q: 'How many times in the last 30 days?', exact: 'How many visits, exactly?' },
      visitsPrevious30Days: { q: 'And the 30 days before that?', exact: 'How many visits, exactly?' },
      visitsLast60Days: { q: 'How many visits in the last 60 days?' },
      packageUnused: { q: 'Is there an unused package or pack of sessions?' },
      bankedCredits: { q: 'How many credits are banked?' },
      currentPain: { q: 'Is there pain right now?' },
      subscriptionHasAdditionalTests: { q: 'Does the subscription include tests beyond the basic panel?' },
      bothWearables: { q: 'Do you wear both?' },
      roomTemperatureC: { q: "What's the thermostat set to at night?" },
    } satisfies Record<AskableField, { q: string; line?: string; exact?: string }>,
  },
  dayOne: {
    reading: 'Reading your stack',
    things: (n: number) => (n === 1 ? '1 thing.' : `${n} things.`),
    aMonth: (dollars: string) => `$${dollars} a month.`,
    line: (s: { dropsToday: number; monthlyBack: string; linedUp: number; cantMeasure: number; keep: number; protectedCount: number; notReadYet: number }) => {
      const parts = [
        s.dropsToday === 1
          ? `1 comes off today, $${s.monthlyBack} a month back.`
          : `${s.dropsToday} come off today, $${s.monthlyBack} a month back.`,
        s.linedUp === 1 ? '1 lined up for testing.' : `${s.linedUp} lined up for testing.`,
      ];
      if (s.cantMeasure) parts.push(s.cantMeasure === 1 ? "1 we can't measure, cost shown." : `${s.cantMeasure} we can't measure, cost shown.`);
      if (s.keep) parts.push(`${s.keep} to keep.`);
      if (s.protectedCount) parts.push(`${s.protectedCount} left alone.`);
      if (s.notReadYet) parts.push(s.notReadYet === 1 ? '1 not read yet.' : `${s.notReadYet} not read yet.`);
      return parts.join(' ');
    },
    showMe: 'Show me',
    groups: {
      drop: { title: 'No test needed', line: 'The answer is already known. The money comes back today.' },
      test: { title: 'Tested on you', line: 'A wearable can see these. Three days on, three off, one number, one word.' },
      cant: { title: "Can't measure it", line: "We can't see these in your data and we won't pretend to. The cost is shown; the call is yours." },
      keep: { title: 'Keep', line: 'Worth keeping, on the evidence or on how you use it.' },
      protected: { title: 'Protected', line: 'We leave these alone.' },
      unread: { title: 'Not read yet', line: 'Counted in the total. The reading comes when the routing engine lands.' },
    },
    reasons: {
      'dose too low': 'Dose too low',
      'form not absorbed': 'Form not absorbed',
      'tested, found nothing': 'Tested, found nothing',
      'no way it could work': 'No way it could work',
      'overlaps with something else': 'Overlaps with something else',
      'not being used': 'Not being used',
    },
    perMonth: (dollars: string) => `$${dollars} a month`,
    perYear: (dollars: string) => `$${dollars} a year`,
    letItGo: 'Let it go',
    keepItAnyway: 'Keep it anyway',
    runItAnyway: 'Run it anyway',
    leaveIt: 'Leave it',
    beingChecked: 'Being checked',
    safety: 'Safety note',
    watch: (metric: string) => `We'd watch: ${/^[A-Z][a-z]/.test(metric) ? metric[0]!.toLowerCase() + metric.slice(1) : metric}`,
    chance: (word: string) => `Chance of a clear answer: ${word}`,
    hypothesisLabel: 'From your history',
    overlapTitle: 'These two do the same job.',
    overlapLine: 'Keep the one you use. The other one goes.',
    keepThis: (name: string) => `Keep ${name}`,
    suggested: (a: string, b: string) => `Suggested, on visits: ${a} against ${b}.`,
    firstTitle: 'Your first experiment.',
    firstLine1: 'Fourteen days from Monday. Three days on, three days off.',
    firstLine2: 'Each morning: one line, one tap. A missed tap counts as unknown, never as a miss.',
    observeLine: 'Off nights only. We never assign a drink.',
    monthsQ: 'Roughly how many months has this been part of your days?',
    monthsUnit: 'months',
    start: 'Start the first experiment',
    notThisOne: 'Not this one',
    pickAnother: 'Which one instead?',
    emptyTitle: 'Nothing to read yet.',
    emptyLine: 'Add at least one thing to your stack and come back.',
    backToStack: 'Back to your stack',
    error: "We couldn't read your stack. Nothing was lost.",
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
  if (f.length === 1 && /\bs\b/.test(f.toString().slice(0, 40)))
    return f({ dropsToday: 10, monthlyBack: '767', linedUp: 4, cantMeasure: 2, keep: 4, protectedCount: 1, notReadYet: 1 });
  return f('Magnesium', 5);
}
