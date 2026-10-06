# The app in the brand-v4 identity (branch app-brand-v4)

What changed in `apps/web`, why, and what is still open. Built on `brand-v4` (the landing re-skin and `docs/DESIGN.md`).

## The flow, in the Figma build's order

| Step | Route | What it does | Data |
| --- | --- | --- | --- |
| Arrival | `/` | "Distill your life." Tap or wait. People with saved progress pick up where they left off. | progress.step |
| Your stack | `/stack` | Two stages. Talk it through: the text is matched against the 210 catalog items as they type, and "Find my essentials" adds the matches. Then the list: costs, where each came from, add anything not listed. "Try it with an example stack" loads the Worked Example. | catalog search |
| Your life | `/life` | What they want their life to be, in their words, plus the goal chips the engine routes on. | lifeText, goals |
| A few questions | `/questions` | Two questions about the person first (anything from a doctor → Protected; anything they'd never give up → theirs, never tested), then the existing engine-driven follow-ups. | origin, dayOne.yours, answers |
| The number | `/number` | Their item names gather, then the count and monthly cost. | routed |
| Here's what we heard | `/heard` | Quotes what they typed and lists what they'd never give up. No claims about who they are. | lifeText, yours |
| Your stack, sorted | `/sorted` | Four groups on one surface: Yours, Worth reading on you, Ready to let go, Your call. | routed + groupOf |
| Ready to let go | `/ready` | What settles today, with overlap pairs to choose between. The first reason is open; the rest are a private reading until they join. Keep anyway works on open items. | routed |
| The invitation | `/invitation` | Founding membership, free while we build it. No price in the app. Joining opens every reason. | member |
| Connect | `/connect` | Last step. Saves where everything landed (statuses) and goes to Today. | dataSource |
| Today, Verdicts, Your Standard, Settings | as before | Restyled. "Your file" is now "Your Standard". | demo source |

`/goals` and `/day-one` are gone; old saved steps resume at `/life` and `/sorted`.

## Real routing

`lib/data/engine.ts` routes the person's own stack through `routeStack` (Phase 3) on the server (`lib/data/route-action.ts`, so the catalog never ships to the browser), and words each item with `renderAuditVerdict` (Phase 7) for where it actually landed. When the renderer has no reviewed figure to quote, the catalog's day-one sentence is used only if the engine routed the item to its usual tier; otherwise a plain sentence per drop reason, or "one more answer and we can read this".

The goal an item is judged by: the one the person gave for it, else the usual reason people take it (`usualGoalFor`, parsed from the catalog's usual-goal text, so a facial is read for skin even when the headline goal is sleep), else the headline goal. The questions flow uses the same order (`usualRuleGoalFor` in `lib/followups/goals.ts`), so it asks what the router will need.

The Worked Example fixture still drives the demo person once demo data is connected (`usesDemoFixture`), so the team's sheet tests hold.

## Merged with Rohan's backend (main, 6 October)

- Kept: the API client (`lib/api.ts`), Supabase progress for signed-in people (`RemoteProgressStore`, `saveNow`), the live connection check, file import (Apple Health ZIP or CSV), and the experiment start (`POST /api/app/experiments` with test length and the person's own on and off conditions).
- The audit behind Sorted and Ready is the engine routing in `lib/data/engine.ts` (Veer's call). `lib/data/audit-action.ts` and `src/server/audit.ts` are no longer used by any screen; delete them or fold what they add into `engine.ts`.
- The first-experiment card from the old day-one screen now ends Connect (`app/(onboarding)/connect/first-reading.tsx`), since Connect is the last onboarding step. A finished import returns to Connect for it.

## Look

`app/globals.css` tokens are the DESIGN.md identity under the old names where the idea matches (`--mint` is retired for `--accent`). Fonts are Cormorant Garamond and Manrope via `next/font`. Square corners, hairlines, no glass or blur except the locked reasons. The writing screens sit on the bronze dusk (`components/onboarding/ground.tsx`).

## Open, for the team

- **Demo numbers change at Connect.** Before connecting, the engine settles 3 of the example person's 21 items ($57 back); after "Use demo data", the hand-made fixture shows 10 ($767). Decide whether the demo should use the engine throughout, or the fixture throughout.
- **Founding membership is free and local.** `progress.member` unlocks the reasons. When pricing is switched on, this is the seam for checkout.
- **The guarantee line** is still out of the app (GUARANTEE_COPY).
- **Dose thresholds and study summaries** for `renderAuditVerdict` would let "dose too low" items quote the real figure instead of the generic sentence.
- **Free-text matching** is keyword search over names and aliases. A model reading the paragraph is a later step.
