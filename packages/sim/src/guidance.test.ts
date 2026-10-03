import { expect, it } from 'vitest';
import { powerGuidance, simulationReferenceProtocol } from './guidance.js';
it('replaces source labels with conservative empirical labels only within the simulated scope', () => {
  expect(powerGuidance(0.8, simulationReferenceProtocol)).toMatchObject({
    status: 'estimated',
    label: 'fair',
    scenarioId: '42d-3d-reference',
  });
  expect(powerGuidance(1.2, simulationReferenceProtocol)).toMatchObject({
    status: 'estimated',
    label: 'good',
  });
  expect(powerGuidance(0.2, simulationReferenceProtocol)).toMatchObject({
    status: 'estimated',
    label: 'low',
  });
  for (const config of [
    { totalDays: 14 },
    { ...simulationReferenceProtocol, dropFirstNightOfBlock: true },
    { ...simulationReferenceProtocol, minimumNightsPerSide: 6 },
  ])
    expect(powerGuidance(0.8, config).status).toBe('unavailable');
  expect(powerGuidance(0.9, simulationReferenceProtocol).status).toBe('unavailable');
  expect(powerGuidance(0.8, { totalDays: 42, blockLength: 0 }).status).toBe('unavailable');
  expect(
    powerGuidance(0.8, simulationReferenceProtocol, { testPolicy: 'benefit_only' }).status,
  ).toBe('unavailable');
  expect(powerGuidance(0.8, simulationReferenceProtocol, { baselineDays: 7 }).status).toBe(
    'unavailable',
  );
  expect(
    powerGuidance(0.8, simulationReferenceProtocol, { metric: 'overnightHrvMs' }),
  ).toMatchObject({ status: 'estimated' });
  expect(() => {
    (simulationReferenceProtocol.blockLengths as number[])[0] = 2;
  }).toThrow();
});
