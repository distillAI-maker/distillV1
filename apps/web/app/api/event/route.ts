import postgres from 'postgres';
import { eventSchema } from '../../../lib/funnel';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

let sql: ReturnType<typeof postgres> | undefined;

/** Far more than anyone tapping through onboarding sends; past it, a device is flooding the table. */
const PER_MINUTE = 120;
const recent = new Map<string, { since: number; n: number }>();
function flooding(device: string, now: number) {
  const r = recent.get(device);
  if (!r || now - r.since > 60_000) {
    if (recent.size > 5000) recent.clear();
    recent.set(device, { since: now, n: 1 });
    return false;
  }
  r.n += 1;
  return r.n > PER_MINUTE;
}

/**
 * Records one funnel event (lib/funnel.ts). Same-origin only. Always answers 204, so a missing
 * database or a bad request never shows up for the person; nothing personal is accepted.
 */
export async function POST(request: Request) {
  const done = new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  if (request.headers.get('origin') !== new URL(request.url).origin) return done;
  if (!request.headers.get('content-type')?.startsWith('application/json')) return done;
  const text = await request.text();
  if (text.length > 2000) return done;
  let parsed;
  try {
    parsed = eventSchema.safeParse(JSON.parse(text));
  } catch {
    return done;
  }
  if (!parsed.success || !process.env.DATABASE_URL) return done;
  const { event, device, source, props } = parsed.data;
  if (flooding(device, Date.now())) return done;
  try {
    sql ??= postgres(process.env.DATABASE_URL, { prepare: false, max: 1, idle_timeout: 20 });
    await sql`insert into public.app_events (device, event, props, source)
      values (${device}, ${event}, ${sql.json(props)}, ${source ?? null})`;
  } catch {
    console.error('event: insert failed');
  }
  return done;
}
