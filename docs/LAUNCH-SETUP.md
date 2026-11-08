# Launch setup: sign-in and the funnel

The code for both is built. They switch on with the settings below (dashboard access needed: Veer or Rohan). Never paste keys or passwords into chat or code; put them straight into Vercel.

## 1. Supabase (the same project Ishan uses for the landing page)

1. **Tables.** If the Supabase GitHub integration applies migrations on merge, this happens on its own. Otherwise, in the SQL editor, run the files in `supabase/migrations/` that are not applied yet, at least `20261006222901_app_journey.sql` (saved progress) and `20261013000001_app_events.sql` (the funnel).
2. **Auth → URL Configuration.**
   - Site URL: `https://distill-app-nu.vercel.app`
   - Redirect URLs: `https://distill-app-nu.vercel.app/auth/callback` and `https://*-distill-dd01.vercel.app/auth/callback` (previews)
3. **Auth → Emails → SMTP.** Supabase's built-in email sends only a few messages an hour (and on newer projects only to your own team), which is not enough for a room of 200. Add a custom SMTP sender, for example Resend (free tier), so every magic link arrives.

## 2. Vercel (`distill-app`, Settings → Environment Variables, Production and Preview)

| Name | Where to find it | Note |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API → Project URL | public |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon key | public by design |
| `DATABASE_URL` | Supabase → Connect → Transaction pooler connection string, with the database password | mark Sensitive |
| `TEAM_EMAILS` | The team's own addresses, comma-separated | who can open the funnel page, `/team` |

Then redeploy (Deployments → the latest → Redeploy).

**Check it worked:** open the app in a private window and go through onboarding. The invitation asks for an email, and the magic link arrives and signs you in.

## 3. The QR code

Point it at `https://distill-app-nu.vercel.app/?src=class`. Everyone who comes in that way is counted under `class`. Use a different `src` per channel (`linkedin`, `tiktok`, `ig`).

## 4. Reading the numbers

Open https://distill-app-nu.vercel.app/team, signed in with an address in `TEAM_EMAILS`: how far people get through onboarding, the screen they were on when they stopped, how long each screen takes, and what they do in the app, by date range and by source. Tap "Don't count this device" on every phone you test with.

From a terminal (needs `DATABASE_URL` in `apps/web/.env.local`):

```bash
npx tsx apps/web/scripts/funnel.ts 7d class
```

`docs/FUNNEL.md` explains every number, lists what's counted, and has the same queries for Supabase's SQL editor. Only screens, times and taps are stored, never what anyone writes or their email.
