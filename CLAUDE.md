# Distill

Distill builds each person's unique personal Ritual: the whole system of their mornings, nights and weekends, so they are free to live the rest of their life on their own terms. Less noise. More you.

## Read first

1. **`docs/HANDOVER.md`**: what Distill is, the voice, the brand, who owns what, what is built, the decisions already made, and the five priorities. It wins over every older doc.
2. **`docs/AI-BACKEND.md`**: where the AI backend stands, the path to Claude shaping real Rituals, and the quality loop.
3. **`docs/ENGINE.md`**: the Ritual engine as built (rules, Claude's steps, storage, switches, evaluation, going live).
4. `docs/ROUTING-V4.md` for the routing table; `eval/coverage.md` for the golden set.

Older docs (`SPEC.md`, `docs/DIRECTION.md`, `docs/Product-Context.md`, the phase docs) are history: their test-first framing, verdicts and gallery-white look are superseded. Raise a mismatch rather than following them.

## Repo

- **Landing page** in `public/` (static, no build step): https://distill-v1-tau.vercel.app.
- **App** in `apps/web` (Next.js): https://distill-app-nu.vercel.app. pnpm workspace: `packages/engine` (the Ritual engine's rules, `toneLint`), `packages/catalog` (V3 and V4 routing tables), `packages/data`, `packages/providers` (wearables).
- **iOS app** in `apps/mobile`: a Capacitor shell that opens the live app, outside the pnpm workspace (its own `npm ci`). Build and run: `apps/mobile/README.md`; the App Store steps: `docs/APP-STORE.md`.

## Commands

- Node 24, pnpm 10.34.6 (`npx -y pnpm@10.34.6 …`): `install --frozen-lockfile`, `catalog:build`, `check` (lint, types, tests, catalog, tone), `build:web`.
- Engine: `eval:gates` (free, seconds), `eval:engine` (rules only; `--claude --judge --yes` spends about $15), `eval:ab`, `engine:backfill`.
- Landing page preview: `python3 -m http.server 3000 -d public`.

## Rules

- Never push to `main`: it deploys the site and the app. Work on a branch, open a PR, request Ishan as reviewer; Veer merges.
- `git fetch` and check `origin/main` before saying what the code does.
- Never commit `.env` files, keys or `apps/web/next-env.d.ts`. The Supabase publishable key in `public/assets/js/join.js` and `apps/web/lib/waitlist.ts` is meant to be public.
- Claude stays off unless a flag or setting turns it on; nothing spends by accident.
- Flag changes in a teammate's area (Ishan: engine and V4; Rohan: Supabase, API, deploy settings) in the PR instead of deciding for them.
