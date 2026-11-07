import { createClient } from '@supabase/supabase-js';
import { database, type Database } from '@distill/data';
import { z } from 'zod';
import { progressSchema } from '../../../lib/progress/types';
import { Journey } from '../../../src/server/journey';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Joining saves their progress on the server before the email goes out, so the link keeps it even
 * when it opens somewhere else: the Gmail app's own browser, another phone, the iOS app.
 *
 * Only ever for a brand-new address: creating the account fails for one that exists, and then
 * nothing is written. No session, no email and no confirmation happen here; opening the link is
 * still what signs them in and confirms the address. If anything is missing or fails, this answers
 * kept:false and the link carries progress from this browser, as it always has.
 */
let db: Database | undefined;
const PER_ADDRESS_HOUR = 5;
const seen = new Map<string, number[]>();

function allowed(address: string, now = Date.now()): boolean {
  const recent = (seen.get(address) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_ADDRESS_HOUR) return false;
  seen.set(address, [...recent, now]);
  if (seen.size > 5000) seen.delete(seen.keys().next().value!);
  return true;
}

function sameSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

const inputSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254), progress: progressSchema }).strict();

export async function POST(request: Request) {
  const answer = (kept: boolean) => Response.json({ kept }, { headers: { 'Cache-Control': 'no-store' } });
  if (!sameSite(request)) return new Response(null, { status: 403 });
  const text = await request.text();
  if (text.length > 200_000) return new Response(null, { status: 413 });
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;
  if (!url || !key || !databaseUrl) return answer(false);
  const address = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
  if (!allowed(address)) return answer(false);
  try {
    const { email, progress } = inputSchema.parse(JSON.parse(text));
    const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await admin.auth.admin.createUser({ email });
    if (error || !data.user) return answer(false);
    db ??= database(databaseUrl).db;
    await new Journey(db).save(data.user.id, { ...progress, fromJoin: true });
    return answer(true);
  } catch {
    return answer(false);
  }
}
