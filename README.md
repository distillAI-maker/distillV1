# Distill

Distill is being built in eight phases, one pull request per phase. The product brief is [SPEC.md](SPEC.md).

**Phases 1–7 are implemented locally; overall MVP acceptance remains pending.** The backend includes the catalog, item rules, provider adapters/imports, auth/private storage, stack audit, experiments, statistics, synthetic people, power checks and local demo profiles. Phase 7 adds all 17 filled verdict templates, accurate contextual variants, rounded measurements and runtime tone checks; demo API results include their narratives. See [docs/POWER.md](docs/POWER.md), [docs/DEMO.md](docs/DEMO.md) and [docs/VERDICTS.md](docs/VERDICTS.md). Phase 8 screens are connected to authenticated progress, calculated audits and the experiment/results engine. Hosted runtime acceptance remains pending; see [docs/APP_INTEGRATION.md](docs/APP_INTEGRATION.md).

Phase 3's worked-example acceptance remains blocked by source contradictions and missing answers; the engine keeps those cases conservative. See [docs/ALGORITHM.md](docs/ALGORITHM.md) for contracts and [docs/MVP_STATUS.md](docs/MVP_STATUS.md) for a plain-English progress overview.

The saved 14-day default has insufficient randomization resolution for a decisive result. Phase 6 measures explicit 28/42-day alternatives; the 42-day reference supports the 0.8/1.2 power claims only under the declared synthetic assumptions. It is exported as an explicit protocol option, with no change to saved registrations. New experiments test both directions with a shared 5% error budget. Interval coverage is insufficient in some tested profiles, so result cards suppress the interval. Experiment HTTP routes now connect the app to saved registrations, compliance and results; see [docs/APP_INTEGRATION.md](docs/APP_INTEGRATION.md).

Phase 2 setup, API contracts, platform constraints, and live acceptance steps are in [docs/DATA_SOURCES.md](docs/DATA_SOURCES.md). Local implementation does not establish real-account provider access or deploy the database.

The existing marketing site remains in `public/`. Vercel serves that folder directly; its install and build commands are explicitly empty so this phase's workspace tooling does not change the deployed site. The original setup instructions are preserved in [docs/LANDING.md](docs/LANDING.md).

## Where things stand

- **Live:** https://distill-v1-tau.vercel.app, serving version 3 of the page (October 2026).
- **App:** https://distill-app-nu.vercel.app, the Phase 8 screens on demo data, a second Vercel project rooted at `apps/web` that also redeploys on every push to `main`.
- **Connected:** this repo deploys to Vercel on every push to `main`, and the sign-up forms save to the Supabase `signups` table.
- **To change the site:** edit `public/index.html`, commit, and push to `main`. Vercel publishes it in about a minute.

## Local checks

Use **Node.js 24** and **pnpm 10.34.6** (recorded in `.node-version` and `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm catalog:build
pnpm check
pnpm build:web
pnpm sim:check
```

`pnpm check` runs ESLint, TypeScript, Vitest, the generated-catalog freshness check, and tone checks over all 17 verdict templates. CI runs the same checks for every PR and push to `main`.

To preview the existing landing page:

```sh
python -m http.server 3000 -d public
```

## Files

| Path                                             | Purpose                                                                        |
| ------------------------------------------------ | ------------------------------------------------------------------------------ |
| `SPEC.md`                                        | Supplied product specification, preserved verbatim                             |
| `data/Routing-Table_V3.xlsx`                     | Supplied source workbook, preserved byte-for-byte                              |
| `data/catalog.json`                              | Generated typed catalog, workbook hash, and all nonblank source cells/formulas |
| `packages/catalog`                               | SheetJS reader, Zod schemas, validators and ingest tests                       |
| `packages/engine`                                | Pure TypeScript item rules and tone checks; no runtime I/O                     |
| `vendor/xlsx-0.20.3.tgz`                         | Official SheetJS archive, pinned locally with integrity in the lockfile        |
| `docs/CATALOG.md`                                | Phase 1 contracts, examples and workbook update process                        |
| `docs/OPEN_QUESTIONS.md`                         | Source conflicts and decisions requiring the team                              |
| `docs/LANDING.md`                                | Landing page setup and editing instructions                                    |
| `.github/workflows/ci.yml`                       | PR validation                                                                  |
| `public`, `supabase`, `scripts/build_routing.py` | Existing landing page and its signup/data tooling                              |

The V3 workbook title includes a "What changed in version 4" section. We retain its supplied filename and record the mismatch instead of silently renaming it. It contains **13 sheets** (including an unlisted Glossary), **210 items**, **18 overlap groups**, **93 fact-check flags**, and **9 observe-only items**. All Summary counts validate. The brief's "19 groups" and the worked example's conflicting prose totals are recorded as open questions.

The older `docs/Routing-Table.xlsx` and `public/routing.json` serve the marketing widget. New app code uses `data/Routing-Table_V3.xlsx`; the Python landing-page builder does not generate the app catalog.

## Phase boundaries

1. Catalog ingestion and item rules — this PR.
2. Provider adapters and data storage/auth integration — implemented locally; live acceptance requires credentials.
3. First-match stack routing and overlap decisions — core implemented; strict `pnpm routing:golden` acceptance remains blocked by the source.
4. Experiment scheduling and immutable pre-registration — implemented and locally tested; live migration pending.
5. Statistics and decision rules — implemented and locally tested; conditional simulation evidence and remaining limitations documented.
6. Synthetic people, simulation and demo users — implemented and measured locally; conditional model evidence, with coverage/missingness limitations.
7. Filled verdict text and snapshots — implemented and locally tested, with result-aware variants and demo narratives.
8. Next.js app flows — implemented on demo data; live integration pending.

Source evidence and copy have been ingested, not independently fact-checked. `unverified` follows every item into rule results. Phase 1 does not publish new user-facing advice or introduce billing.
