'use server';
import { screenAudit } from '../../src/server/audit';
import { progressSchema } from '../progress/types';
import type { Progress } from '../progress/types';
export async function calculateAudit(input: Progress) {
  return screenAudit(progressSchema.parse(input));
}
