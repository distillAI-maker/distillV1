/**
 * The demo person's first experiment: coffee after 2pm, the Worked Example's first assigned
 * test. The nights, the schedule, the taps and the verdict are produced by the engine in
 * `./index.ts`; only the identity and the two daily lines live here.
 */
export const demoExperimentId = 'demo-coffee';
export const demoItemKey = 'coffee-after-2pm';
export const demoInstruction = { on: 'Coffee as usual.', off: 'No coffee after 2pm.' } as const;
/** The two daily lines for the items the demo can run; anything else gets a plain pair. */
export const demoInstructions: Record<string, { on: string; off: string }> = {
  'coffee-after-2pm': demoInstruction,
  'alcohol-in-the-evening': { on: 'A drink in the evening.', off: 'No drinks tonight.' },
  'training-after-7pm': { on: 'Train after 7pm, as usual.', off: 'Finish training before 7pm.' },
  'late-dinner-within-2-3-h-of-bed': { on: 'Dinner at the usual late hour.', off: 'Finish dinner three hours before bed.' },
};
