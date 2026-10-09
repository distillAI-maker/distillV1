'use server';

import { progressSchema } from '../../progress/types';
import type { Experiment, Verdict } from '../types';
import { demoExperiments, demoVerdicts } from './run';

/**
 * The signed-out demo's experiment and verdict, computed on the server from the progress the
 * browser holds. The engine, the catalog and the synthetic person never ship to the client.
 */
export async function fetchDemoExperiments(progress: unknown, nowIso: string): Promise<Experiment[]> {
  return demoExperiments(progressSchema.parse(progress), new Date(nowIso));
}
export async function fetchDemoVerdicts(progress: unknown, nowIso: string): Promise<Verdict[]> {
  return demoVerdicts(progressSchema.parse(progress), new Date(nowIso));
}
