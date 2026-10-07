# Distill

Distill has two parts in this repo:

- **The marketing site** in `public/` (one static `index.html`, no build step). Vercel serves it on every push to `main`: https://distill-v1-tau.vercel.app.
- **The app,** being built in eight phases, one PR each, from `SPEC.md`. It's a pnpm workspace: `packages/catalog` builds `data/catalog.json` from `data/Routing-Table_V3.xlsx`, and `packages/engine` holds the item rules and `toneLint`. Phase 2 (`origin/phase-2/data-sources`) is in progress; don't edit its packages from another branch.

## Read first

- `SPEC.md`: the app brief and its non-negotiables (not a medical product; Protected items untouched; observe-only items; locked pre-registration; Tone Guide is law).
- `README.md` and `docs/CATALOG.md`: current phase and contracts.
- `docs/OPEN_QUESTIONS.md`: team decisions. Log conflicts there; don't decide them silently.
- `docs/Product-Context.md`: Veer's product, brand and strategy context (luxury and identity direction, ICP, onboarding vision). It is newer than parts of `SPEC.md` and disagrees with it in places (paywall, look, test-first vs history-first). Raise mismatches rather than picking a side.
- `docs/Emotional-Positioning-Research.md`: tone rules for any user-facing copy.

## Commands

- App checks (Node 24, pnpm 10.34.6): `pnpm install --frozen-lockfile`, `pnpm catalog:build`, `pnpm check`
- Landing page preview: `python3 -m http.server 3000 -d public`

## Rules

- Pushing to `main` publishes the marketing site within about a minute. Work on a branch and open a PR.
- The Supabase publishable key in `public/index.html` is meant to be public. Never commit `.env` files or service-role keys.
- `public/routing.json` (landing widget, built by `scripts/build_routing.py`) and `data/catalog.json` (app) are separate pipelines.
