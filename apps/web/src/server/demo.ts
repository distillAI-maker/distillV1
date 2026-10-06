import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import { nightRecordSchema } from '@distill/providers';

const ids = [
  '60000000-0000-4000-8000-000000000001',
  '60000000-0000-4000-8000-000000000002',
  '60000000-0000-4000-8000-000000000003',
] as const;
const viewSchema = z.object({
  synthetic: z.literal(true),
  userId: z.enum(ids),
  name: z.string(),
  asOf: z.iso.date(),
  from: z.iso.date(),
  to: z.iso.date(),
  inventory: z.array(z.unknown()),
  answers: z.record(z.string(), z.unknown()),
  audit: z.record(z.string(), z.unknown()),
  auditText: z.array(z.unknown()).optional(),
  nights: z.array(nightRecordSchema.extend({ source: z.literal('synthetic') })),
  workouts: z.array(z.object({ source: z.literal('synthetic') }).passthrough()),
  tags: z.array(z.object({ source: z.literal('synthetic') }).passthrough()),
  experiment: z.record(z.string(), z.unknown()),
});
const fixturesSchema = z
  .object({
    version: z.literal(1),
    synthetic: z.literal(true),
    users: z.array(viewSchema).length(3),
  })
  .refine((fixtures) => new Set(fixtures.users.map((user) => user.userId)).size === 3);
export async function loadDemoFixtures() {
  // pnpm dev runs in apps/web; scripts and tests run from the repository root.
  for (const file of [resolve('.local/demo-users.json'), resolve('../../.local/demo-users.json')]) {
    try {
      return fixturesSchema.parse(JSON.parse(await readFile(file, 'utf8'))).users;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  throw new Error('demo_not_seeded');
}
export function createDemoHandler(options: {
  enabled: () => boolean;
  load: () => Promise<unknown>;
}) {
  return async (request: Request): Promise<Response> => {
    const reply = (body: unknown, status = 200) =>
      Response.json(body, {
        status,
        headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
      });
    if (!options.enabled()) return reply({ error: 'not_found' }, 404);
    if (request.method !== 'GET') return reply({ error: 'demo_is_read_only' }, 405);
    const path = new URL(request.url).pathname.replace(/\/$/, '');
    const match = /^\/api\/demo\/users(?:\/([^/]+))?$/.exec(path);
    if (!match || (match[1] && !ids.some((id) => id === match[1])))
      return reply({ error: 'not_found' }, 404);
    try {
      const users = fixturesSchema.parse({
        version: 1,
        synthetic: true,
        users: await options.load(),
      }).users;
      if (!match[1])
        return reply({
          synthetic: true,
          readOnly: true,
          users: users.map((user) => ({ userId: user.userId, name: user.name, asOf: user.asOf })),
        });
      return reply(users.find((user) => user.userId === match[1]));
    } catch {
      return reply({ error: 'demo_not_seeded', action: 'Run pnpm seed:demo locally' }, 503);
    }
  };
}
export const handleDemoRequest = createDemoHandler({
  enabled: () => process.env.DEMO_ENABLED === 'true',
  load: loadDemoFixtures,
});
