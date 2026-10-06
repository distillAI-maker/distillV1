# Phase 2 data sources

The app now connects these provider/import APIs to authenticated onboarding, calculated audits and persisted experiments/results. For the current browser workflow, migration version and hosted acceptance steps, see [APP_INTEGRATION.md](APP_INTEGRATION.md). The API-only setup below remains supported.

Implementation status: provider adapters, import parsers, persistence, OAuth, sync workers and API routes are implemented. Phases 3–7 add stack routing, experiments, statistics, simulation, local demo data and verdict text; experiment HTTP routes and app screens are not yet wired. Deployment and real-account acceptance require the configuration below. Conditional power evidence is in [POWER.md](POWER.md); local demo setup is in [DEMO.md](DEMO.md) and text rendering is in [VERDICTS.md](VERDICTS.md).

## Platform verification (2026-10-02)

| Source                      | Current web path and implementation                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Oura                        | API v2 OAuth; sleep, readiness, workouts, legacy and enhanced tags. Optional workout/tag scopes may be declined. [Authentication](https://cloud.ouraring.com/docs/authentication), [API schema](https://cloud.ouraring.com/v2/static/json/openapi-1.41.json).                                                                                                                                                                                                                                     |
| WHOOP                       | Developer API v2 OAuth with offline access; sleep, recovery, cycles and workouts. The public API does not document Journal/tag answers, so the adapter does not invent them. [API](https://developer.whoop.com/api/), [refresh tokens](https://developer.whoop.com/docs/developing/oauth).                                                                                                                                                                                                        |
| Fitbit                      | Legacy compatibility adapter, **disabled by default**. Support ended September 30, 2026; the currently announced shutdown is October 30, 2026. Google Health API is the replacement; its migration notice says new projects are not being onboarded. An existing approved legacy client can explicitly enable the adapter until shutdown. Google Health migration remains a launch dependency requiring team access. [Official migration notice](https://developers.google.com/health/migration). |
| Google Fit / Health Connect | Do not start a Google Fit integration. Current guidance says support ends in 2026. Health Connect stores data on Android and requires a native integration; it cannot be read directly by this website. [Current migration guide](https://developer.android.com/health-and-fitness/health-connect/migration/fit).                                                                                                                                                                                 |
| Apple Health                | HealthKit is a native SDK, not a browser API. Import `export.zip` in this phase. The SAX parser streams `export.xml`; it does not construct a whole XML tree or extract ZIP paths onto disk. [HealthKit](https://developer.apple.com/documentation/healthkit), [export instructions](https://support.apple.com/en-ca/guide/iphone/iph5ede58c3d/ios).                                                                                                                                              |
| Garmin                      | Explicit unavailable adapter until partner approval. Apply through the Garmin Connect Developer Program, describe the product/use case, complete approval and the evaluation environment, then implement against the granted documentation. No invented public endpoint. [Health API program](https://developer.garmin.com/gc-developer-program/health-api/).                                                                                                                                     |
| CSV                         | Fallback import only. Explicit unit columns, blank means unknown, zero remains zero.                                                                                                                                                                                                                                                                                                                                                                                                              |
| Synthetic                   | Owner-bound provider with seeded metric generation, workout/tag fixtures and three persistent local demo profiles. See [DEMO.md](DEMO.md); this does not create a real wearable connection.                                                                                                                                                                                                                                                                                                       |

## Data contract

`packages/providers` exports `Provider`, `NightRecord`, `Workout`, `Tag` and the adapters. Adapters receive a user-bound client and raw-payload writer. A future native companion can normalize into the same types; no unauthenticated native ingestion endpoint is exposed.

Nights are unique by user, source and **local wake/sleep date**. Query date bounds are inclusive `from`, exclusive `to`, expressed as UTC calendar labels, not instants in the server's local timezone. Workouts retain their actual start timestamps. We choose the longest primary sleep for a date, with a stable ID tie-break; naps and multiple devices are not added together.

Durations are minutes, efficiency is percent, HRV is milliseconds, heart rate is bpm, breathing is breaths/minute, temperature deviation is Celsius. Missing measurements are `null`. HRV includes `hrvMethod`: Apple SDNN must not be pooled with Oura/WHOOP/Fitbit RMSSD. Device model is nullable when a platform does not provide it. Raw records are stored privately in Postgres and linked through `rawPayloadId`.

Oura resting heart rate maps to its documented lowest sleeping heart rate. WHOOP's absolute skin temperature is retained in raw recovery data, not presented as a deviation. General awake duration is not silently relabelled as wake-after-sleep-onset. Apple exports require an explicit `sourceName` to avoid combining duplicated sources. Apple sessions are inferred from sleep intervals separated by at most 90 minutes, and overlapping generic/staged sleep is counted once. Apple latency, efficiency and temperature deviation remain unknown without a reliable source measurement. These conventions need comparison against real exports before launch.

## Run and configure

Use Node 24 and pnpm 10.34.6. `pnpm install --frozen-lockfile`, `pnpm check`, and `pnpm build:web` validate the workspace. `pnpm dev` starts the Phase 2 API; onboarding screens are Phase 8.

The web scripts use webpack with `.js` → TypeScript extension resolution because workspace source uses NodeNext imports. `postgres` and `unzipper` are explicit web runtime dependencies so Next can externalize them and trace their files into the deployment. CI verifies the production build without provider credentials; secrets are loaded only when a configured API operation runs.

1. Use a Supabase project with the existing `supabase/schema.sql` signup table. Apply `supabase/migrations/202610020001_phase_two.sql` through your migration workflow, then `supabase/migrations/202610020002_phase_four.sql` for experiment storage. Review the migrations before applying them to production. The Phase 4 tables are server-only, with immutable-registration triggers and one-active-experiment constraints; see [ALGORITHM.md](ALGORITHM.md).
2. Copy `apps/web/env.example` to `apps/web/.env.local`. Set the Supabase URL, anon key, server-only service-role key and Postgres connection URL. Use a TLS-protected database connection in deployment. Transaction poolers require `prepare: false`, already set in the client.
3. Generate a random 32-byte base64 `TOKEN_ENCRYPTION_KEY`; the example includes the command. Use a separate random `CRON_SECRET` of at least 32 characters. Store both as deployment secrets, never in Git. Preserve the encryption key while tokens exist; rotating it requires re-encrypting tokens or reconnecting providers.
4. Register Oura/WHOOP OAuth apps and set client IDs/secrets. Register exact callbacks `APP_URL/api/providers/oura/callback` and `APP_URL/api/providers/whoop/callback`. Test only with accounts authorized for those clients.
5. Configure Supabase email magic links. For the API-only confirmation route, use the email template link `{{ .SiteURL }}/api/auth/confirm?token_hash={{ .TokenHash }}&type=email`, and set Site URL to `APP_URL`. The confirmation endpoint returns a session JSON response with no-store headers; Phase 8 owns the browser session UI. Subsequent API requests send its access token as `Authorization: Bearer ...`.
6. Deploy a **separate Vercel project rooted at `apps/web`**, with access to workspace files outside the root. Its `vercel.json` schedules `/api/cron/sync` at 09:00 UTC daily. Set the same server secrets. The root configuration still deploys the marketing site. [Vercel cron authentication](https://vercel.com/docs/cron-jobs/manage-cron-jobs).

No database migration, provider registration or live deployment is performed merely by installing this code.

Phase 5 uses the Phase 4 tables without a new SQL migration. New registration JSON includes the saved test policy and raw baseline values; the existing immutable-registration trigger protects both. Legacy records retain their original one-sided policy. The server should pass owner-bound normalized records and saved check-ins to `@distill/engine/stats`, then use `experimentResultCard` for UI data rather than exposing internal diagnostics. Phase 6 measures conditional power and hides intervals without demonstrated coverage. Its demo-profile table and Auth/Storage scaffold exist only in the local fixture database; no hosted migration is added.

## API

| Method and path                                   | Behavior                                                                                                                                              |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/health`                                 | Basic API availability; no secrets required.                                                                                                          |
| `POST /api/auth/magic-link`                       | JSON `{ "email": "you@example.com" }`; Supabase handles sending and email rate limits.                                                                |
| `GET /api/auth/confirm`                           | Consumes the configured email token hash and returns a Supabase session.                                                                              |
| `POST /api/providers/{oura,whoop,fitbit}/connect` | Authenticated request returns `authorizationUrl` and an HttpOnly, SameSite=Lax OAuth state cookie. Navigate in the same browser.                      |
| `GET /api/providers/{provider}/callback`          | Verifies browser binding and consumes single-use, expiring state; encrypts tokens and starts durable backfill.                                        |
| `GET /api/providers`                              | Authenticated connection/backfill/import status; never returns credentials.                                                                           |
| `POST /api/sync`                                  | Resumes this user's due work after responding.                                                                                                        |
| `POST /api/imports`                               | JSON `{ "source": "csv" }` or `{ "source": "apple_export", "sourceName": "exact XML sourceName" }`; returns an import ID and registered Storage path. |
| `POST /api/imports/{id}/complete`                 | Verifies the owner's uploaded object exists, queues parsing and starts the worker.                                                                    |
| `GET /api/nights?from=YYYY-MM-DD&to=YYYY-MM-DD`   | Authenticated normalized records, at most 366 dates per request, exclusive upper bound.                                                               |
| `DELETE /api/account`                             | Deletes the authenticated user's account and application data.                                                                                        |
| `GET /api/cron/sync`                              | Requires exact `Authorization: Bearer CRON_SECRET`; resumes due work.                                                                                 |

Upload directly to the returned Supabase Storage URL with the user's access token and the project's public anon key (`apikey` header), or use Supabase Storage's authenticated upload/TUS client for large exports. Use POST and no upsert. Storage RLS permits only pre-registered paths for a live, non-deleting owner. Then call the completion endpoint. This avoids routing large exports through Vercel's request-body limit. ZIPs are limited to 256 MiB compressed, XML to 1 GiB and one million selected records. CSVs are limited to 20 MiB and 50,000 nights. Imports that exceed runtime/memory limits require a larger worker environment; their job state remains visible.

CSV headers: `sleepDate`, optional `deviceModel`, `hrvMethod`, and any metric property from `NightRecord` (for example `totalSleepMinutes`, `overnightHrvMs`, `restingHeartRateBpm`). Unknown or duplicate headers, missing `sleepDate` headers, duplicate dates, invalid numbers and HRV without a method are rejected. Example:

```csv
sleepDate,totalSleepMinutes,deepSleepMinutes,overnightHrvMs,hrvMethod
2026-10-01,420,60,45,rmssd
2026-10-02,405,,,
```

## Sync and deletion behavior

Connection starts a recent-data sync, followed by historical windows down to 1970 (before these platforms existed), following every page and never treating an empty window as the end of history. Daily sync rereads eight local date labels to catch late corrections. Durable cursors advance only after the entire window is committed. Token refresh is serialized under a connection lease and rotating refresh tokens are encrypted with AES-256-GCM and user/provider-bound authenticated data. Expired leases can be reclaimed; obsolete workers cannot commit. Rate limits retain the cursor and schedule retry; revoked credentials require reconnect.

The callback and import completion use Next's `after()` to start work. Each worker invocation drains work for approximately four minutes; cron or `POST /api/sync` resumes the backlog. For a separate worker process, load the environment and run `pnpm providers:worker` repeatedly until backfill is complete. On platforms where the daily invocation cannot drain the backlog, provision this worker before launch. [Next after lifecycle](https://nextjs.org/docs/app/api-reference/functions/after).

Deletion first marks the account as deleting, blocking new writes and upload authorization. It removes tracked private uploads and the matching landing signup, then hard-deletes the Supabase Auth user. Foreign-key cascades remove connections, encrypted tokens, OAuth states, normalized records, raw records, import jobs, experiment cycles, registrations and check-ins. Failed Storage/Auth deletion returns a retryable error and retains the deleting record. Upstream wearable accounts/data and database backup retention are outside this application's deletion boundary. [Supabase user deletion](https://supabase.com/docs/guides/auth/managing-user-data).

## Acceptance still requiring credentials

- Apply the migration to a disposable Supabase project and exercise Storage upload, magic-link delivery and account deletion against the hosted services.
- Connect an approved Oura and WHOOP test account, compare returned nights with their apps, exercise refresh and backfill, and confirm provider-specific history/scopes.
- Confirm Google Health project access and migration before offering a Fitbit connection at launch. Legacy access is not a substitute for approval.
- Obtain Garmin approval before implementing its API.

Automated tests use mocked provider responses, real Postgres via PGlite for migration/transactions/RLS/cascades, and API request tests. They do not claim a live provider acceptance test.
