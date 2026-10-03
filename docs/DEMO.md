# Synthetic demo users

`pnpm seed:demo` creates three named demo identities, six calendar months of normalized sleep data, synthetic workouts/tags, a Worked Example inventory, a completed 42-day coffee experiment, daily check-ins and calculated results. It uses a persistent local Postgres database (`.local/demo-db`, through PGlite) and writes read-only API fixtures to `.local/demo-users.json`. Both paths are ignored by Git.

It requires Node 24 and `pnpm install --frozen-lockfile`, with no Supabase account, wearable, hosted database or API credentials. The command never uses `DATABASE_URL` or creates real sign-in accounts. The local database applies the existing application migrations against an isolated Auth/Storage scaffold; this is not hosted Supabase acceptance.

```powershell
pnpm seed:demo --as-of=2026-10-03 --seed=20261003
$env:DEMO_ENABLED = 'true'
pnpm dev
```

On macOS/Linux use `DEMO_ENABLED=true pnpm dev`. The default as-of date is the current date in Los Angeles; passing a date makes the dataset reproducible. Month-end dates clamp to the last day of the earlier month. History includes the as-of wake date, with an exclusive upper bound the following day.

Open `http://localhost:3000/api/demo/users` to list the profiles, then `/api/demo/users/{userId}` for history, stack audit, saved daily schedule, check-ins and the safe result-card payload. These JSON endpoints are the integration surface for Phase 8 screens. There is still no end-to-end clickable onboarding or morning-check-in UI. Demo endpoints are explicitly enabled, read-only, limited to the three known synthetic IDs, and never load the live service. Live user routes still require verified Supabase authentication.

| Name   | Synthetic user ID                      | Injected truth                  | Result with the example seed/date |
| ------ | -------------------------------------- | ------------------------------- | --------------------------------- |
| Alex   | `60000000-0000-4000-8000-000000000001` | On condition adds 1.2 swings    | Kept                              |
| Sam    | `60000000-0000-4000-8000-000000000002` | On condition removes 1.2 swings | Dropped                           |
| Jordan | `60000000-0000-4000-8000-000000000003` | No effect                       | Inconclusive                      |

These results are calculated, not hard-coded or obtained by searching favorable seeds. A different seed/date may give different verdicts. On means **skip coffee after 2pm**, off means keep the usual routine. Kept retains that restriction; Dropped discontinues the restriction. Demo effects are invented test data, not claims about coffee or a person’s physiology.

The inventory preserves the Worked Example’s ambiguous answers and routing diagnostics. It substitutes a free protected “Demo sleep data” source for the example’s paid Oura source, so the demo does not imply a real Oura connection. It does not silently invent the missing fish-oil goal, workout intensity or bedtime gap, or change the blocked golden totals.

Rerunning the same seed replaces only the three marked local fixture accounts in one transaction. It does not duplicate nights, alter unrelated local users or overwrite an unmarked identity. Raw record pointers resolve to owner-bound raw synthetic payloads. The source, seed and generator version are retained for auditing. Normalized nights, raw payloads, events, cycles and check-ins occupy the same table structures as production; demo profile metadata is local-only.

The API fixture file is replaced atomically only after a successful database seed. An unseeded, disabled or invalid fixture is handled explicitly. On hosted deployments this local file is absent; keep demo disabled until Phase 8 chooses how to bundle or provision synthetic demo data. A cloud database migration or deployment is not performed by this command.

See [POWER.md](POWER.md) for model assumptions and measured power. Internal statistical diagnostics stay in the local database; public result cards exclude p-values and hide unvalidated uncertainty intervals. Phase 7 still owns the final readable verdict wording.

The library entry points are `@distill/sim` for generation/trials/demo bundles, `@distill/sim/local` for isolated persistence, and `@distill/sim/guidance` for the measured power labels and explicit reference protocol. Run `pnpm sim:labels` to rebuild the 210-row review overlay after the power report. `pnpm sim:check` checks report provenance and label freshness; CI runs it without rerunning the expensive Monte Carlo study.

To recreate the chart, install `scripts/requirements-sim.txt` in a Python environment and run `pnpm sim:plot`. One isolated Windows setup is:

```powershell
python -m venv .local/sim-python
.local/sim-python/Scripts/python -m pip install -r scripts/requirements-sim.txt
.local/sim-python/Scripts/python scripts/plot-power.py
```
