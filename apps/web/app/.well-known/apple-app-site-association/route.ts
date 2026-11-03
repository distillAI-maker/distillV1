/**
 * Tells iOS that the Distill app (apps/mobile) may open sign-in links to this site, so the email's
 * link signs someone in inside the app instead of in Safari. iOS reads this when the app is installed.
 * It answers 404 until APPLE_TEAM_ID (the Apple developer team's ID) is set on Vercel.
 */
export const dynamic = 'force-dynamic';

/** apps/mobile/capacitor.config.ts appId. */
const BUNDLE_ID = 'com.distillthenoise.app';

export function GET() {
  const team = process.env.APPLE_TEAM_ID?.trim();
  if (!team || !/^[A-Z0-9]{10}$/.test(team)) return new Response('Not found', { status: 404 });
  return Response.json(
    {
      applinks: {
        details: [
          {
            appIDs: [`${team}.${BUNDLE_ID}`],
            components: [
              { '/': '/auth/callback', comment: 'The sign-in link' },
              // Supabase can send the link to the home page instead; proxy.ts forwards it.
              { '/': '/', '?': { token_hash: '?*' }, comment: 'A sign-in link on the home page' },
              { '/': '/', '?': { code: '?*' }, comment: 'A sign-in link on the home page' },
            ],
          },
        ],
      },
    },
    { headers: { 'Cache-Control': 'public, max-age=3600' } },
  );
}
