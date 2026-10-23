import { engineCatalog } from '../../../lib/catalog/engine';
import { tryInputSchema, tryList } from '../../../src/server/try';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The landing page's "What's on your list?", run on the app's engine. Public and read-only: it takes
 * catalog keys and "came from a feed" marks, stores nothing, and answers any origin.
 */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

/** A few dozen lists a minute per address is plenty for a person tapping chips. */
const PER_MINUTE = 60;
const seen = new Map<string, number[]>();
function allowed(address: string, now = Date.now()): boolean {
  const recent = (seen.get(address) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= PER_MINUTE) return false;
  seen.set(address, [...recent, now]);
  if (seen.size > 5000) seen.delete(seen.keys().next().value!);
  return true;
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(request: Request) {
  const reply = (body: unknown, status = 200) =>
    Response.json(body, { status, headers: { ...CORS, 'Cache-Control': 'no-store' } });
  const address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!allowed(address)) return reply({ error: 'busy' }, 429);
  const text = await request.text();
  if (text.length > 8000) return reply({ error: 'too long' }, 413);
  let parsed;
  try {
    parsed = tryInputSchema.safeParse(JSON.parse(text));
  } catch {
    return reply({ error: 'bad json' }, 400);
  }
  if (!parsed.success) return reply({ error: 'bad input' }, 400);
  return reply(tryList(parsed.data, engineCatalog()));
}
