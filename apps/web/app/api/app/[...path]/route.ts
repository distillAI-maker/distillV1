import { database } from '@distill/data';
import { z } from 'zod';
import { supabaseServer } from '../../../../lib/supabase/server';
import { progressSchema } from '../../../../lib/progress/types';
import { Journey } from '../../../../src/server/journey';
import { screenAudit } from '../../../../src/server/audit';
import { HttpError } from '../../../../src/server/service';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;
let journey: Journey | undefined;
const json = (data: unknown, status = 200) =>
  Response.json(data, {
    status,
    headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
  });
async function body(request: Request) {
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    throw new HttpError(415, 'json_required');
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (request.body) {
    const reader = request.body.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > 262144) {
          await reader.cancel();
          throw new HttpError(413, 'request_too_large');
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}
async function handle(request: Request) {
  try {
    const client = await supabaseServer();
    if (!client) throw new HttpError(503, 'authentication_not_configured');
    const token = /^Bearer (\S+)$/i.exec(request.headers.get('authorization') ?? '')?.[1];
    // Verify against Auth; never trust a user ID in the request body or a decoded cookie.
    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user || data.user.is_anonymous)
      throw new HttpError(401, 'authentication_required');
    const url = new URL(request.url),
      path = url.pathname.replace('/api/app/', '');
    if (request.method !== 'GET' && !token && request.headers.get('origin') !== url.origin)
      throw new HttpError(403, 'same_origin_required');
    if (!process.env.DATABASE_URL) throw new HttpError(503, 'database_not_configured');
    journey ??= new Journey(database(process.env.DATABASE_URL).db);
    const userId = data.user.id;
    if (path === 'progress') {
      if (request.method === 'GET') return json(await journey.load(userId));
      if (request.method === 'POST') {
        await journey.save(userId, progressSchema.parse(await body(request)));
        return json({ status: 'saved' });
      }
      if (request.method === 'DELETE') {
        await journey.clear(userId);
        return json({ status: 'cleared' });
      }
    }
    if (path === 'audit' && request.method === 'POST')
      return json(screenAudit(progressSchema.parse(await body(request))));
    if (path === 'experiments' && request.method === 'GET')
      return json(await journey.snapshot(userId));
    if (path === 'experiments' && request.method === 'POST') {
      const input = z
        .object({
          itemKey: z.string().min(1).max(150),
          timeZone: z
            .string()
            .max(100)
            .refine((v) => {
              try {
                new Intl.DateTimeFormat('en', { timeZone: v });
                return true;
              } catch {
                return false;
              }
            }),
          days: z.union([z.literal(14), z.literal(28), z.literal(42)]),
          onDefinition: z.string().trim().min(1).max(1000),
          offDefinition: z.string().trim().min(1).max(1000),
        })
        .strict()
        .parse(await body(request));
      return json(await journey.start(userId, input), 201);
    }
    const match = /^experiments\/([^/]+)\/(check-in|finish|advance-demo|cancel)$/.exec(path);
    if (match && request.method === 'POST') {
      const id = z.uuid().parse(match[1]);
      if (match[2] === 'check-in') {
        const input = z
          .object({
            sleepDate: z.iso.date(),
            tap: z.enum(['did', 'didnt']).optional(),
            exposure: z.enum(['on', 'off']).optional(),
            exclusions: z
              .array(z.enum(['ill', 'travelling', 'kids_woke_me', 'unusually_hard_session']))
              .max(4)
              .optional(),
          })
          .strict()
          .parse(await body(request));
        return json(await journey.checkIn(userId, id, input));
      }
      if (match[2] === 'finish') return json(await journey.finish(userId, id));
      if (match[2] === 'cancel') return json(await journey.cancel(userId, id));
      const { all } = z
        .object({ all: z.boolean() })
        .strict()
        .parse(await body(request));
      return json(await journey.advanceDemo(userId, id, all));
    }
    return json({ error: 'not_found' }, 404);
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    if (error instanceof z.ZodError) return json({ error: 'invalid_input' }, 400);
    return json({ error: 'request_failed' }, 503);
  }
}
export const GET = handle;
export const POST = handle;
export const DELETE = handle;
