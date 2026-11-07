import { z } from 'zod';
import { engineCatalog } from '../../../lib/catalog/engine';
import { catalog } from '../../../lib/catalog/server';
import { withAnchors } from '../../../lib/onboarding/reveal';
import { people } from '../../../lib/onboarding/you';
import { progressSchema } from '../../../lib/progress/types';
import { previewCompose } from '../../../src/server/engine';
import { engineClient } from '../../../src/server/engine-deps';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Claude's first Ritual usually takes about 30 seconds, and can take a minute with a retry.
export const maxDuration = 90;

const claudeOn = () => process.env.ENGINE_CLAUDE === 'on' && !!process.env.ANTHROPIC_API_KEY;

/**
 * Anyone can reach the reveal signed out, so Claude's version is rationed: a few per address an
 * hour and a ceiling a day on each server instance. Past either, the rules version stays.
 */
const PER_ADDRESS_HOUR = 3;
const PER_INSTANCE_DAY = 200;
const seen = new Map<string, number[]>();
let day = { date: '', count: 0 };

function allowed(address: string, now = Date.now()): boolean {
  const date = new Date(now).toISOString().slice(0, 10);
  if (day.date !== date) day = { date, count: 0 };
  if (day.count >= PER_INSTANCE_DAY) return false;
  const recent = (seen.get(address) ?? []).filter((t) => now - t < 3_600_000);
  if (recent.length >= PER_ADDRESS_HOUR) return false;
  seen.set(address, [...recent, now]);
  if (seen.size > 5000) seen.delete(seen.keys().next().value!);
  day.count += 1;
  return true;
}

const inputSchema = z.object({ progress: progressSchema, timeZone: z.string().max(100).optional() }).strict();

/** Only this site asks for this: nobody else's page spends the ration. */
function sameSite(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.get('host');
  } catch {
    return false;
  }
}

/**
 * The onboarding reveal, Claude's version: the rules draft named and paired in their words. `parts`
 * is null when Claude is off (ENGINE_CLAUDE), rationed out, or when its version fell back to rules.
 * Nothing is stored.
 */
export async function POST(request: Request) {
  const none = () => Response.json({ parts: null }, { headers: { 'Cache-Control': 'no-store' } });
  if (!sameSite(request)) return new Response(null, { status: 403 });
  const text = await request.text();
  if (text.length > 200_000) return new Response(null, { status: 413 });
  let parsed;
  try {
    parsed = inputSchema.safeParse(JSON.parse(text));
  } catch {
    return new Response(null, { status: 400 });
  }
  if (!parsed.success) return new Response(null, { status: 400 });
  if (!claudeOn()) return none();
  const address = (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
  if (!allowed(address)) return none();
  try {
    const shaped = await previewCompose(parsed.data.progress, {
      catalog: engineCatalog(),
      toneRules: catalog.toneRules,
      client: engineClient(),
      ...(parsed.data.timeZone ? { timeZone: parsed.data.timeZone } : {}),
    });
    if (shaped?.from !== 'claude') return none();
    // The study promised "Your Ritual will make room for them": if Claude's version didn't, this does.
    const who = people(parsed.data.progress);
    const parts = who ? withAnchors(shaped.parts, { people: who }) : shaped.parts;
    return Response.json({ parts }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return none();
  }
}
