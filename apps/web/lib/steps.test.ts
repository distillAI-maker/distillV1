import { describe, expect, it } from 'vitest';
import { stepSchema } from './progress/types';
import { NUMBERED_STEPS, nextStep, onboardingSteps, resumePath, stepForPath, stepNumber } from './steps';

describe('onboarding steps', () => {
  it('run name, then the seven steps to the first Ritual, then the invitation and connect', () => {
    expect(onboardingSteps).toEqual(['name', 'stack', 'number', 'best', 'yours', 'reveal', 'invitation', 'connect']);
    expect(nextStep('stack')).toBe('number');
    expect(nextStep('number')).toBe('best');
    expect(nextStep('yours')).toBe('reveal');
    expect(nextStep('reveal')).toBe('invitation');
    expect(nextStep('connect')).toBe('done');
  });

  it('number seven steps, with the name unnumbered and the invitation and connect sharing 7', () => {
    expect(NUMBERED_STEPS).toBe(7);
    expect(onboardingSteps.map(stepNumber)).toEqual([null, 1, 3, 4, 5, 6, 7, 7]);
  });

  it('are all steps a save can hold', () => {
    for (const s of onboardingSteps) expect(stepSchema.options).toContain(s);
  });

  it('find the step from the path', () => {
    expect(stepForPath('/best')).toBe('best');
    expect(stepForPath('/reveal/')).toBe('reveal');
    expect(stepForPath('/life')).toBeUndefined();
  });

  it('resume older saves where their answers now live', () => {
    expect(resumePath('life')).toBe('/best');
    expect(resumePath('goals')).toBe('/best');
    expect(resumePath('questions')).toBe('/number');
    for (const s of ['heard', 'sorted', 'ready', 'day-one']) expect(resumePath(s)).toBe('/invitation');
    expect(resumePath('done')).toBe('/home');
    expect(resumePath('yours')).toBe('/yours');
    expect(resumePath('reveal')).toBe('/reveal');
    expect(resumePath('something-else')).toBe('/stack');
  });
});
