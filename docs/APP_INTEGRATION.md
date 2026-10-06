# Backend-connected app

The marketing site serves `public/`. The product app is the separate Vercel project rooted at `apps/web`.

## Screen-to-backend map

| Screen                  | Backend connection                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------- |
| Sign in                 | Supabase magic link; `/auth/callback` writes the browser session                                               |
| Connect                 | Authenticated provider connect/status/sync APIs; OAuth redirects back to Connect                               |
| Import                  | Direct private Storage upload, import queue and status; Apple ZIP or CSV                                       |
| Stack, goals, questions | Complete validated progress saved through `/api/app/progress`                                                  |
| Day one                 | Phase 3 stack router with actual answers, goals, protection and overlap choices                                |
| Start test              | `/api/app/experiments`: server calculates baseline and locks the registration, source, conditions and duration |
| Today                   | Saved schedule, source-specific measurements and authenticated check-ins; cancellation and explicit completion |
| Verdicts                | Phase 5 analysis and Phase 7 text; immutable persisted result card                                             |
| Your file               | Saved stack decisions and persisted verdicts                                                                   |
| Settings                | Saved preferences; account deletion invokes the Phase 2 Storage cleanup/tombstone flow before Auth deletion    |

## Configuration

Use Node 24 and pnpm 10.34.6. Apply migrations in filename order, including `20261006222901_app_journey.sql`. This additive migration was applied to the scoped hosted project on October 6, 2026; its local filename matches the hosted version.
Supabase project: `hzwiikkttligpmkvondy`. An MCP OAuth login is administrative access for the agent; it is not the app's database connection or service key.

Copy `apps/web/env.example` to `apps/web/.env.local`. Configure the same values in the **app** Vercel project:

- `APP_URL`: app origin, not the marketing URL.
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`: browser Auth configuration.
- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`: backend Auth/Storage configuration.
- `DATABASE_URL`: TLS-protected Postgres connection for the server-only tables. Transaction pooler connections use `prepare: false`.
- `TOKEN_ENCRYPTION_KEY`: a stable random 32-byte base64 key; keep it when tokens already exist.
- `CRON_SECRET`: at least 32 characters, also set for Vercel cron authentication.
- Provider client IDs/secrets and `NEXT_PUBLIC_PROVIDERS_ENABLED=true` only when those clients are approved and configured.

In Supabase Auth, allow `${APP_URL}/auth/callback` and use an email link with `token_hash` and `type=email` pointing there, or the existing PKCE redirect flow. Provider callbacks remain `/api/providers/{provider}/callback`.

## Explore the calculated demo

Sign in, choose **Use demo data**, enter or edit your stack, complete goals/questions and open Day one. This audit is calculated rather than copied from the Worked Example. Source contradictions remain unresolved; protected or unresolved items cannot start a test.

Choose a resolved candidate, specify two distinct conditions and a duration, then start. Today shows its saved schedule. Use **Next demo morning** to move the simulated clock, or **Simulate remaining demo nights** to fill synthetic compliance for unrecorded demo nights. Existing exclusions and taps are preserved. **Calculate and save verdict** runs the statistics/text engine and stores the result. Synthetic data never enters real wearable tables. Demo advancement is rejected for real experiments.

With no configured Supabase account, the device-only preview retains its old fixture experiment; it is not the authenticated backend journey. Configure credentials and sign in to test persistence and the actual experiment APIs.

## Imported/live journey

Import a CSV (required `sleepDate`, optional camelCase metric fields; HRV needs `hrvMethod`) or Apple Health ZIP with an exact `sourceName`. Check job completion, then complete onboarding. A baseline with insufficient history waits seven days and still requires usable measurements. Real experiments start on Monday, accept only elapsed wake dates, and cannot complete before the saved final wake date. Sync/import new measurements as they arrive. Missing values stay missing; a result without an effect shows **Not enough measurements**.

Fourteen days cannot yield a decisive result under the current assignment support. Selecting 28 or 42 days is explicit; it does not establish real-world efficacy. Observe-only candidates get no assigned exposure instructions. Their self-reported exposure and observational limitations remain visible. Source fact-check blockers are preserved.

## Verification and live acceptance

`pnpm check` and `pnpm build:web` validate the code. The journey integration tests apply all migrations to isolated Postgres-compatible databases and exercise owner scoping, registration immutability, future-night rejection, baseline failures, compliance/exclusions, saved verdicts and Auth deletion cascades. API tests verify Auth identity and reject cross-site cookie writes.

For hosted acceptance, sign in as two separate test users. Reload each user's stack and check that the other user's data is unavailable. Run a demo through completion and reload its verdict. Import a real authorized file and verify missing measurements. Test failed uploads and rejected/future check-ins. Delete only a disposable test account with a private uploaded object; confirm the object and all account-owned rows disappear. Run cron with its configured secret and verify sync status. Local tests and database metadata checks alone do not certify hosted email delivery, runtime secrets, Storage deletion or provider approval.

Hosted database verification confirmed all four server-only journey/experiment tables have RLS enabled and neither `anon` nor `authenticated` has SELECT access. Their HTTP APIs authenticate the owner before server-side queries. Runtime credentials and Vercel environment settings were not available in the implementation session, so the hosted browser journey and Storage deletion remain acceptance tasks.

The Supabase advisor's [RLS enabled without policies notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) is expected for these server-only tables: client grants are revoked, and owner access is enforced by the authenticated server APIs.
