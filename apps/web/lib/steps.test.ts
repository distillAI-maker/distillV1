import { describe, expect, it } from 'vitest';
import { stepSchema } from './progress/types';
import { NUMBERED_STEPS, nextStep, onboardingSteps, resumePath, stepForPath, stepNumber } from './steps';

describe('onboarding steps', () => {
  it('run name, then the steps to the first Ritual, then the invitation and connect', () => {
    expect(onboardingSteps).toEqual(['name', 'stack', 'number', 'study', 'reveal', 'invitation', 'connect']);
    expect(nextStep('stack')).toBe('number');
    expect(nextStep('number')).toBe('study');
    expect(nextStep('study')).toBe('reveal');
    expect(nextStep('reveal')).toBe('invitation');
    expect(nextStep('connect')).toBe('done');
  });

  it('number six steps, with the name unnumbered and the invitation and connect sharing 6', () => {
    expect(NUMBERED_STEPS).toBe(6);
    expect(onboardingSteps.map(stepNumber)).toEqual([null, 1, 3, 4, 5, 6, 6]);
  });

  it('are all steps a save can hold', () => {
    for (const s of onboardingSteps) expect(stepSchema.options).toContain(s);
  });

  it('find the step from the path', () => {
    expect(stepForPath('/study')).toBe('study');
    expect(stepForPath('/reveal/')).toBe('reveal');
    expect(stepForPath('/life')).toBeUndefined();
  });

  it('resume older saves where their answers now live', () => {
    for (const s of ['life', 'goals', 'best', 'yours']) expect(resumePath(s)).toBe('/study');
    expect(resumePath('questions')).toBe('/number');
    for (const s of ['heard', 'sorted', 'ready', 'day-one']) expect(resumePath(s)).toBe('/invitation');
    expect(resumePath('done')).toBe('/home');
    expect(resumePath('study')).toBe('/study');
    expect(resumePath('reveal')).toBe('/reveal');
    expect(resumePath('something-else')).toBe('/stack');
  });
});
