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
    line: 'Not who you were told to be. Who you are.',
    begin: 'Begin',
    resume: 'Pick up where you left off',
    tapToBegin: 'Distill your life. Begin.',
    haveAccount: 'I already have an account',
  },
  name: {
    title: 'Distill your life.',
    label: 'Name',
    placeholder: 'Your first name',
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
    apple: 'Import your nights',
    appleHint: 'Apple Health export or a CSV file',
    appleHow: 'How to export from the Health app',
    demo: 'Use demo data',
    demoLine:
      'A made-up person with six months of nights and a 21-item stack. Nothing here is yours yet.',
    unavailable: 'Not yet connected in this build.',
    backfillTitle: 'Reading your history.',
    backfillCount: (n: number) => `${n} nights so far`,
    backfillDone: 'Six months of nights, ready.',
    open: 'Open your Standard',
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
    scratchHint: 'We match what we recognise as you type. Anything else stays in your notes.',
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
      doctor: 'A doctor',
      'blood test': 'A blood test',
      friend: 'A friend',
      podcast: 'A podcast',
      online: 'TikTok, Instagram or an ad',
      other: "Can't remember",
    },
    originAsk: 'Where did this come from?',
    listen: {
      title: 'Talk us through what you do for yourself.',
      line: 'Include memberships, supplements, treatments and habits.',
      label: 'Tell us what you already do for yourself',
      placeholder: 'I go to Equinox, take AG1 most mornings, do Pilates twice a week…',
      heard: (n: number) =>
        n === 1 ? 'We recognise 1 thing so far.' : `We recognise ${n} things so far.`,
      find: 'Find my essentials',
      example: 'Try it with an example stack',
    },
    edit: {
      title: 'Your current stack',
      note: "Add what we missed and remove what isn't yours.",
      emptyNote: "Search the 210 things we can read, or add something we don't list.",
    },
    protectedTag: 'Protected',
    dataSourceTag: 'Your data source',
    remove: (name: string) => `Remove ${name}`,
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
  life: {
    title: 'Tell us about your ideal day',
    label: 'Tell us about your ideal day',
    placeholder: 'I start the day with a morning meditation in the sunlight…',
    empty: 'Take your time.',
    chars: (n: number) => (n === 1 ? '1 character' : `${n} characters`),
    goalsTitle: 'What would you most like to change?',
    done: 'All done',
  },
  person: {
    doctorQ: 'Did a doctor put you on any of these?',
    keepQ: 'What would you never give up?',
    none: 'None of these',
  },
  number: {
    things: (n: number) => (n === 1 ? '1 thing.' : `${n} things.`),
    aMonth: (dollars: string) => `$${dollars} a month.`,
    line: 'None of it measured on you yet.',
    showMe: 'Show me',
  },
  sorted: {
    title: 'Your real stack.',
    groups: {
      yours: { title: 'Protected.' },
      read: { title: 'To possibly remove.' },
      go: { title: 'Ready to let go.' },
      call: { title: 'Your call.' },
    },
    empty: 'Nothing here.',
    next: 'Show me what can go',
  },
  ready: {
    title: (n: number) =>
      n === 0
        ? 'Nothing to let go of today.'
        : `${['One thing', 'Two things', 'Three things', 'Four things', 'Five things', 'Six things', 'Seven things', 'Eight things', 'Nine things', 'Ten things'][n - 1] ?? `${n} things`} you can let go of today.`,
    noneLine: 'Everything is protected, still to be read on you, or your call.',
    privateReading: 'Private reading',
    aMonthBack: 'a month, back.',
    next: 'See why',
    memberNext: 'Continue',
  },
  invitation: {
    title: 'Find your standard.',
    line: 'We read your essentials against your own data to find your ideal stack.',
    reportTitle: 'Summary',
    essentials: 'Essentials',
    monthly: 'A month',
    quote: 'Lighter, and more me.',
    manifesto: [
      'Fewer things.',
      'The right things, lived consistently.',
      'Anything new, chosen deliberately.',
    ],
    includesTitle: 'What founding membership includes',
    includes: [
      { label: 'The full reading', detail: 'Every reason, for everything in your stack.' },
      {
        label: 'Readings on your own data',
        detail: 'One thing at a time, judged against your normal swing.',
      },
      { label: 'Your Standard', detail: 'What stays yours, and what you let go, in one place.' },
      { label: 'Your patterns, over time', detail: 'A clearer picture of what works for you.' },
    ],
    free: 'Free while we build it',
    freeLine: 'No card. Nothing to buy today.',
    begin: 'Join as a founding member',
    emailLabel: 'Email',
    emailPlaceholder: 'you@example.com',
    emailError: 'That address does not look right. Check it and try again.',
    joined: 'Welcome, founding member.',
    joinedNamed: (name: string) => `Welcome, ${name}.`,
    joinedLine: 'Your reading is open. Connect your wearable next.',
    linkSent: (email: string) =>
      `We sent a link to ${email}. Open it on this device to keep your reading.`,
    linkFailed: "We couldn't send the link. Your reading is still saved on this device.",
    connect: 'Connect my wearable',
  },
  firstReading: {
    title: 'Your first reading.',
    none: 'Nothing in your stack can be read from your nights yet. Your sort is saved.',
    lineLocal: 'A first read at day 14, and a verdict by day 28.',
    lineLive:
      'Choose the conditions and the length before you start. Both stay locked for this test.',
    lengthNote:
      'Fourteen days rarely gives a clear answer with this design. Longer tests still depend on how complete your data is.',
    duration: 'Test length',
    days: { 14: '14 days, a first look', 28: '28 days', 42: '42 days' },
    onLabel: 'Your on condition',
    offLabel: 'Your off condition',
    onObserve: 'What counts as happening?',
    offObserve: 'What counts as not happening?',
    observeNote:
      'Keep your usual routine. These labels describe what happens; no on or off days are assigned.',
    start: 'Start my first reading',
    starting: 'Starting',
    finish: 'Save and continue',
    errorBaseline:
      'We have too few usable nights for your baseline. Import or sync your history, then try again.',
    errorActive: 'A test is already running. Open Today to carry on.',
    errorOther: "The test didn't start. Your sort is saved; try again.",
  },
  routing: {
    /** One plain sentence per drop reason, for when the engine has no reviewed figure to quote yet. */
    reasonLine: {
      'dose too low':
        'Studies saw a change at higher amounts than this. The amount is the problem, not you.',
      'form not absorbed':
        'Studies found this form is poorly absorbed. The form is the problem, not you.',
      'tested, found nothing':
        'This has been tested properly, and the studies found nothing to measure.',
      'no way it could work': "There's no known way this could do what it's sold for.",
      'overlaps with something else': 'Something else in your stack already does this job.',
      'not being used': "You're not using this right now. Your call whether it stays.",
    },
    fallback: {
      drop: 'Settled on the answers you gave. The money comes back today.',
      test: 'Your own nights can answer this one.',
      cant: "We can't see this in your data. The cost is shown; the call is yours.",
      keep: 'Worth keeping.',
      protected: 'We leave this alone.',
      unread: 'One more answer and we can read this.',
    },
  },
  questions: {
    count: (k: number, n: number) => `Question ${k} of ${n}`,
    reading: 'Reading your stack',
    errorLoad: "We couldn't load your items. Nothing was lost.",
    thatsRight: "That's right",
    changeIt: 'Change it',
    readFrom: (source: string) => `We read this from your ${source}.`,
    exactLine:
      'The answer you picked sits on the line this one is read on, so the exact number matters.',
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
      age: {
        q: 'How old are you?',
        line: 'Only for this one item; it changes what the studies say.',
      },
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
      nightsPerWeek: {
        q: 'How many nights a week, usually?',
        exact: 'How many nights a week, exactly?',
      },
      dinnerToBedMinutes: {
        q: 'How long between dinner and bed, usually?',
        exact: 'About how many minutes between dinner and bed?',
      },
      bathroomNightsPerWeek: {
        q: 'How many nights a week do you get up for the bathroom?',
        exact: 'How many nights, exactly?',
      },
      vigorous: {
        q: 'Are those sessions hard ones?',
        line: 'Hard means out of breath, not a stroll.',
      },
      workoutToBedMinutes: { q: 'About how many minutes between the end of a session and bed?' },
      workoutEndHour: {
        q: 'When do your sessions usually end?',
        exact: 'What hour does it end, 0 to 23?',
      },
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
      visitsLast30Days: {
        q: 'How many times in the last 30 days?',
        exact: 'How many visits, exactly?',
      },
      visitsPrevious30Days: {
        q: 'And the 30 days before that?',
        exact: 'How many visits, exactly?',
      },
      visitsLast60Days: { q: 'How many visits in the last 60 days?' },
      packageUnused: { q: 'Is there an unused package or pack of sessions?' },
      bankedCredits: { q: 'How many credits are banked?' },
      currentPain: { q: 'Is there pain right now?' },
      subscriptionHasAdditionalTests: {
        q: 'Does the subscription include tests beyond the basic panel?',
      },
      bothWearables: { q: 'Do you wear both?' },
      roomTemperatureC: { q: "What's the thermostat set to at night?" },
      onStatin: { q: 'Are you on a statin?', line: 'CoQ10 has a real use alongside one.' },
      lactoseIntolerant: { q: 'Does dairy upset your stomach?' },
      productOxidised: {
        q: 'Has the serum turned orange or brown?',
        line: 'If it has, the vitamin C is already gone.',
      },
      mealsSkippedMostWeeks: { q: 'Do most weeks end with deliveries skipped or thrown out?' },
      ownsEquivalentHeatOrCold: { q: 'Do you have a sauna or cold plunge at home?' },
      sameNightExfoliation: { q: 'Do you use the retinoid and the acid on the same night?' },
      eyeCreamHasAdditionalActive: {
        q: 'Does the eye cream list an active your moisturiser does not, like retinol or caffeine?',
      },
    } satisfies Record<AskableField, { q: string; line?: string; exact?: string }>,
  },
  dayOne: {
    reading: 'Reading your stack',
    things: (n: number) => (n === 1 ? '1 thing.' : `${n} things.`),
    aMonth: (dollars: string) => `$${dollars} a month.`,
    line: (s: {
      dropsToday: number;
      monthlyBack: string;
      linedUp: number;
      cantMeasure: number;
      keep: number;
      protectedCount: number;
      notReadYet: number;
    }) => {
      const parts = [
        s.dropsToday === 1
          ? `1 comes off today, $${s.monthlyBack} a month back.`
          : `${s.dropsToday} come off today, $${s.monthlyBack} a month back.`,
        s.linedUp === 1 ? '1 lined up for testing.' : `${s.linedUp} lined up for testing.`,
      ];
      if (s.cantMeasure)
        parts.push(
          s.cantMeasure === 1
            ? "1 we can't measure, cost shown."
            : `${s.cantMeasure} we can't measure, cost shown.`,
        );
      if (s.keep) parts.push(`${s.keep} to keep.`);
      if (s.protectedCount) parts.push(`${s.protectedCount} left alone.`);
      if (s.notReadYet)
        parts.push(s.notReadYet === 1 ? '1 not read yet.' : `${s.notReadYet} not read yet.`);
      return parts.join(' ');
    },
    showMe: 'Show me',
    groups: {
      drop: {
        title: 'No test needed',
        line: 'The answer is already known. The money comes back today.',
      },
      test: {
        title: 'Tested on you',
        line: 'A wearable can see these. Three days on, three off, one number, one word.',
      },
      cant: {
        title: "Can't measure it",
        line: "We can't see these in your data and we won't pretend to. The cost is shown; the call is yours.",
      },
      keep: { title: 'Keep', line: 'Worth keeping, on the evidence or on how you use it.' },
      protected: { title: 'Protected', line: 'We leave these alone.' },
      unread: {
        title: 'Not read yet',
        line: 'Counted in the total. One more answer and we can read it.',
      },
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
    watch: (metric: string) =>
      `We'd watch: ${/^[A-Z][a-z]/.test(metric) ? metric[0]!.toLowerCase() + metric.slice(1) : metric}`,
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
  tabs: {
    label: 'App',
    today: 'Today',
    verdicts: 'Verdicts',
    file: 'Standard',
    settings: 'Settings',
  },
  today: {
    title: 'Today',
    dayOf: (k: number, n: number, condition: 'on' | 'off') =>
      `Day ${k} of ${n} · an ${condition} day`,
    didIt: 'Did it',
    didnt: "Didn't",
    noted: 'Noted. The test carries on.',
    stripLabel: 'Fourteen days, three on and three off',
    dayLabel: (k: number, condition: 'on' | 'off', tap: string) => `Day ${k}, ${condition}, ${tap}`,
    taps: { did: 'did it', didnt: "didn't", unknown: 'unknown', none: 'not yet' },
    dontCount: "Don't count last night",
    leaveOutTitle: 'Leave last night out?',
    reasons: ['Ill', 'Travelling', 'Kids woke me', 'Unusually hard session', 'Something else'],
    leaveOut: 'Leave it out',
    keepIn: 'Keep it in',
    leftOut: 'Last night is left out.',
    watching: (metric: string) =>
      `The number we watch: ${metric}. Written down on day one; it doesn't move.`,
    verdictReady: 'Your verdict is ready.',
    readVerdict: 'Read the verdict',
    extendTitle: 'Too close to call yet.',
    extendLine: (days: number) =>
      `The numbers are close, so this runs to day ${days}. Same daily line, nothing new to do.`,
    skipWeek: 'Skip ahead a week (demo)',
    firstReadLine: (date: string) =>
      `First read on ${date}. If it is clear by then, that is the verdict; if it is close, one more week.`,
    emptyTitle: 'Nothing to tap today.',
    emptyLine: 'Your first experiment starts Monday.',
    notStartedLine: 'Start the first experiment on day one and the daily line appears here.',
    seeDayOne: 'See your stack, sorted',
    nextLine: (name: string) => `Next: ${name}. Starts Monday.`,
    demoNote: (day: number) =>
      `Demo data: the nights so far are already behind you, so today is day ${day}.`,
    errorSave: "We couldn't save that. Tap again.",
  },
  verdict: {
    listTitle: 'Verdicts',
    listEmpty: 'No verdicts yet. The first read lands on day 14.',
    notFound: "We couldn't find that verdict.",
    eyebrow: (name: string) => `Verdict · ${name}`,
    effort: (days: number, taps: number) => `${days} days, ${taps} taps.`,
    numberLine: (metric: string) => `${metric} on the days you did it`,
    swingLabel: 'Your normal swing',
    nightsLabel: 'Nights counted',
    of: (a: number, b: number) => `${a} of ${b}`,
    letItGo: 'Let it go',
    keepItAnyway: 'Keep it anyway',
    keepIt: 'Keep it',
    decidedCut: 'Let go. It moves to what you cut.',
    decidedKept: 'Kept. It stays in your count.',
    nextTitle: (name: string) => `Next: ${name}.`,
    nextObserve: 'Off nights only; we never assign a drink.',
    lineUp: 'Line up the next one',
    chartTitle: 'The nights behind it',
    outcome: {
      helps: 'It works for you.',
      costs_you: 'It costs you.',
      no_detectable_benefit: 'It does nothing we can see.',
      too_close_final: 'Too close to call.',
      too_close_extend: 'Too close to call yet.',
      not_enough_nights: 'Not enough usable nights.',
      in_progress: 'Still running.',
    } as Record<string, string>,
    chance: (p: number) =>
      `About ${Math.max(1, Math.min(10, Math.round(p * 10)))} in 10 that it helps.`,
    likelyRange: (lower: string, upper: string) =>
      `The likely size: between ${lower} and ${upper}.`,
    chartOff: 'Without it',
    chartLines:
      'The solid line is the average of the filled nights, the dashed line the average of the others.',
    chartHint: 'Hover or tap a night to see it.',
    night: (k: number, condition: 'on' | 'off', value: string, tap: string) =>
      `Night ${k}, ${condition}: ${value}, ${tap}`,
    nightMissing: (k: number, condition: 'on' | 'off') => `Night ${k}, ${condition}: no reading`,
    unit: (v: number, unit: string) => (unit === 'percent' ? `${v}%` : `${v} ${unit}`),
  },
  file: {
    title: 'Your Standard',
    things: (n: number) => (n === 1 ? '1 thing' : `${n} things`),
    was: (n: number) => `was ${n}`,
    aMonth: (dollars: string) => `$${dollars} a month`,
    wasMoney: (dollars: string) => `was $${dollars}`,
    cutTitle: 'What you cut',
    yoursTitle: "What's yours",
    cutEmpty: 'Nothing cut yet.',
    yoursEmpty: 'Nothing proven on your data yet. Your first verdict lands on day 14.',
    keptOnDayOne: 'kept on day one',
    dayOneTag: 'day one',
  },
  settings: {
    title: 'Settings',
    sourcesTitle: 'Connected sources',
    demoName: 'Demo data',
    sourceNames: {
      demo: 'Demo data',
      oura: 'Oura',
      whoop: 'WHOOP',
      fitbit: 'Fitbit',
      apple_export: 'Apple Health export',
      csv: 'CSV import',
    },
    since: (date: string) => `since ${date}`,
    noSource: 'No source connected.',
    disconnect: 'Disconnect',
    disconnectTitle: 'Disconnect the demo?',
    disconnectLine: 'The demo person and everything you changed go. You start again at Connect.',
    keepIt: 'Keep it',
    addSource: 'Add a source',
    dataTitle: 'Your data',
    exportData: 'Export my data',
    exportHint: 'A JSON file of everything the app holds on you.',
    deleteAll: 'Delete everything',
    deleteTitle: 'Delete everything?',
    deleteLine:
      'Your account, your stack, your taps and every night we pulled. Gone, not archived.',
    keepAccount: 'Keep my account',
    deleted: 'Everything is deleted.',
    displayTitle: 'Display',
    lessMotion: 'Less motion',
    lessMotionHint:
      'Turns off the count-ups and the fades. Your system setting is honoured either way.',
    accountTitle: 'Account',
    signOut: 'Sign out',
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
    return f({
      dropsToday: 10,
      monthlyBack: '767',
      linedUp: 4,
      cantMeasure: 2,
      keep: 4,
      protectedCount: 1,
      notReadYet: 1,
    });
  return f('Magnesium', 5);
}
