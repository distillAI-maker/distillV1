# Distill

Distill is being built in eight phases, one pull request per phase. The product brief is [SPEC.md](SPEC.md).

**Phase 1 implements the catalog foundation:** deterministic workbook ingestion, typed data, 95 hand-written item rules, validation, tests, and CI. Provider integrations, complete stack routing, experiments, statistics, simulation, verdict rendering, and the Next.js UI belong to later PRs. There is no app `dev` command yet.

The existing marketing site remains in `public/`. Vercel serves that folder directly; its install and build commands are explicitly empty so this phase's workspace tooling does not change the deployed site. The original setup instructions are preserved in [docs/LANDING.md](docs/LANDING.md).

## Local checks

Use **Node.js 24** and **pnpm 10.34.6** (recorded in `.node-version` and `package.json`).

```sh
pnpm install --frozen-lockfile
pnpm catalog:build
pnpm check
```

`pnpm check` runs ESLint, TypeScript, Vitest, the generated-catalog freshness check, and tone checks over all 17 verdict templates. CI runs the same checks for every PR and push to `main`.

To preview the existing landing page:

```sh
python -m http.server 3000 -d public
```

## Files

| Path | Purpose |
| --- | --- |
| `SPEC.md` | Supplied product specification, preserved verbatim |
| `data/Routing-Table_V3.xlsx` | Supplied source workbook, preserved byte-for-byte |
| `data/catalog.json` | Generated typed catalog, workbook hash, and all nonblank source cells/formulas |
| `packages/catalog` | SheetJS reader, Zod schemas, validators and ingest tests |
| `packages/engine` | Pure TypeScript item rules and tone checks; no runtime I/O |
| `vendor/xlsx-0.20.3.tgz` | Official SheetJS archive, pinned locally with integrity in the lockfile |
| `docs/CATALOG.md` | Phase 1 contracts, examples and workbook update process |
| `docs/OPEN_QUESTIONS.md` | Source conflicts and decisions requiring the team |
| `.github/workflows/ci.yml` | PR validation |
| `public`, `supabase`, `scripts/build_routing.py` | Existing landing page and its signup/data tooling |

The V3 workbook title includes a “What changed in version 4” section. We retain its supplied filename and record the mismatch instead of silently renaming it. It contains **13 sheets** (including an unlisted Glossary), **210 items**, **18 overlap groups**, **93 fact-check flags**, and **9 observe-only items**. All Summary counts validate. The brief's “19 groups” and the worked example's conflicting prose totals are recorded as open questions.

The older `docs/Routing-Table.xlsx` and `public/routing.json` serve the marketing widget. New app code uses `data/Routing-Table_V3.xlsx`; the Python landing-page builder does not generate the app catalog.

## Phase boundaries

1. Catalog ingestion and item rules — this PR.
2. Provider adapters and data storage/auth integration.
3. Full first-match stack routing, overlap decisions and the worked-example golden test.
4. Experiment scheduling and immutable pre-registration.
5. Statistics and decision rules.
6. Synthetic people, simulation and demo users.
7. Filled verdict text and snapshots.
8. Next.js app flows.

Source evidence and copy have been ingested, not independently fact-checked. `unverified` follows every item into rule results. Phase 1 does not publish new user-facing advice or introduce billing.
