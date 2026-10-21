import { z } from 'zod';
import { opSchema, type EngineEvent } from '@distill/engine/ritual';
import type { Engine } from './engine';
import { HttpError } from './service';

/**
 * /api/app/engine/*: the app's way into the engine. The person is always the signed-in user; nothing
 * in a body names who it is about. Their time zone comes from the X-Time-Zone header.
 */

const text = (max: number) => z.string().trim().min(1).max(max);

export const runEventSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('onboarding') }).strict(),
  z.object({ kind: z.literal('stack-change') }).strict(),
  z.object({ kind: z.literal('refresh') }).strict(),
  z.object({ kind: z.literal('note'), stackItemId: text(120), text: text(4000) }).strict(),
  z.object({ kind: z.literal('answer'), q: text(200), a: text(2000), stackItemId: text(120).optional() }).strict(),
  z
    .object({
      kind: z.literal('edit'),
      scope: z.enum(['base', 'day']),
      date: z.iso.date().optional(),
      ops: z.array(opSchema).min(1).max(20),
    })
    .strict(),
  z
    .object({ kind: z.literal('decision-answer'), decisionId: z.uuid(), answer: z.enum(['yes', 'not-now', 'theirs']) })
    .strict(),
  z.object({ kind: z.literal('part'), partId: text(200), date: z.iso.date(), done: z.boolean() }).strict(),
]);

export async function engineRoute(
  engine: Engine,
  path: string,
  method: string,
  input: unknown,
  userId: string,
  timeZone: string | null,
) {
  const opts = timeZone ? { timeZone: timeZone.slice(0, 100) } : {};
  if (path === 'state' && method === 'GET') return engine.state(userId, opts);
  if (method !== 'POST') throw new HttpError(405, 'method_not_allowed');
  switch (path) {
    case 'run':
      return engine.run(userId, z.object({ event: runEventSchema }).strict().parse(input).event as EngineEvent, opts);
    case 'message':
      return engine.run(userId, { kind: 'message', text: z.object({ text: text(2000) }).strict().parse(input).text }, opts);
    case 'accept':
      return engine.accept(userId, z.object({ versionId: z.uuid() }).strict().parse(input).versionId, opts);
    case 'undo':
      return engine.undo(userId, z.object({ versionId: z.uuid() }).strict().parse(input).versionId, opts);
    case 'settings':
      return engine.setNightsShapeMornings(userId, z.object({ nightsShapeMornings: z.boolean() }).strict().parse(input).nightsShapeMornings, opts);
    case 'explore': {
      const { want, region } = z.object({ want: text(600), region: text(80).optional() }).strict().parse(input);
      return engine.explore(userId, want, region, opts);
    }
    case 'explore-answer': {
      const { ideaId, answer } = z.object({ ideaId: text(120), answer: z.enum(['add', 'decline']) }).strict().parse(input);
      return engine.exploreAnswer(userId, ideaId, answer, opts);
    }
    case 'night-check':
      return (await engine.checkNight(userId, opts)) ?? { state: await engine.state(userId, opts) };
  }
  throw new HttpError(404, 'not_found');
}
