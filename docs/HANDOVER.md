# Distill: team handover

22 October 2026. For Veer, Ishan and Rohan, and for each of our Claude sessions. If you are a Claude session: read this whole file first, then `docs/ENGINE.md`. Where this file and an older doc disagree, this file wins.

---

## 1. What Distill is

**One line:** your unique personal Ritual, so you are free to live the rest of your life on your own terms. Sign-off: "Less noise. More you."

**The problem:** this is the most connected, most marketed generation there has been. Feeds, influencers and endless buying tell people what to take, track and become, and leave them feeling they are never doing enough or never good enough. Wanting to reach your potential is beautiful; the point is to be content while you chase it, and that only comes from your own journey.

**What we do:** Distill builds each person's **Ritual**: the whole system of their mornings, days, evenings, nights and weekends, shaped around who they are. Five jobs, in order:

1. **Clear the noise.** What came from a feed, an ad or someone else's routine and does nothing for them is let go, gently, on evidence (routing table V4).
2. **Know them.** Their words (ideal day, notes, answers), their stack (what they do and spend), their data (wearables). This builds over time.
3. **Shape their Ritual.** Mostly things they already do and love, organised. Values beat data.
4. **Reshape it with life.** A property of the engine, not a feature: they text "out late with the team tonight" and get a warm reply and a slower Saturday.
5. **Explore outward.** Once it feels like theirs, Distill **asks** what they want to try (a region, a skill, a scene, new people) and offers a few real options. It never tells them what to do.

**Positioning (Veer, 22 Oct):** lead with the noise, and with your unique identity and Ritual as the answer. Not a loneliness or mental-health product. Connection comes as a result (people count; explore pushes into real life), so it solves loneliness without being about it. It starts with internal work, then outward.

**The autonomy pillar (Veer, 21 Oct):** like a great phone, people use Distill their own way; never a route they are pushed down. It should feel freeing: finally thinking from your own head instead of influencer noise. Everything is a proposal; "this is mine" is final; no streaks, scores, targets or guilt.

**What it is not:** a lab, a coach with targets, a feed, biomarker personalisation, or medical advice. Anything from a clinician is never touched. No tests or verdicts on screen (the old 28-day test engine stays in the code, switched off).

## 2. Voice and words

- **Voice:** a cool, supportive companion. A friend deep into wellness who is genuinely excited about your life: warm, direct, a little playful, specific, honest, full sentences. Test: would a friend say it over coffee? Not clipped "museum curator" fragments.
- **"Ritual" is the whole system, never one habit.** Say "your Ritual", "part of your Ritual", "your Ritual's morning". Never "a ritual" or "rituals".
- No exclamation marks, no emoji, second person ("you"), never "they/their" about the reader, never "should / must / need to", no banned tone words (`catalog.toneRules`).
- **Evidence rule:** never talk down a well-founded thing someone does (creatine) because they can't feel it.
- **Numbers:** their own times and money are fine ("see you at 10", "$90 a month back"); never health numbers, scores or study figures.

## 3. Brand (for any screen, page or content)

- Source of truth: Veer's Figma brand board (`distill-brand/figma-board-v1`, ask Veer). Palette: ground `#f0ece2`, parchment `#ddd3bf`, travertine `#b9a98f`, olive `#6d7052`, ochre `#b4833e`, **persimmon `#f26342`** (the one loud accent), walnut `#4a3126`, umber `#2b211c`, ink `#11191b`. Type: Newsreader light for display, Source Sans 3 for UI. Mark: the eight-point chisel star.
- Classical art and architecture sit underneath, lightly (a daily public-domain painting with a museum placard on Your Standard). Never tacky: no fake quotes, no Greek words, no columns or laurels.
- Product first: very few words on the landing page and in the app, the product shown inside the brand world; the long brand story belongs in content.
- Marketing comes from a Distill brand account (images, films, carousels), never founders' personal posts or faces: luxury brands don't need founders on camera.

## 4. Team and ownership

| Person | Owns | GitHub |
| --- | --- | --- |
| **Veer Benepal** | Product, taste, brand, marketing; merges PRs | `veerbenepal` |
| **Ishan Vannadil** | The engine's logic and ML, routing table V4, evaluation; Vercel team owner; reviews PRs | `ivannadil`, `distillAI-maker` |
| **Rohan Jain** | Backend: Supabase, the API, data, deploy settings | |

Claude sessions build on branches and open PRs; Ishan reviews; Veer merges. Flag changes in someone else's area in the PR rather than deciding for them.

Class: AI-Assisted Product Development (Sabrina Romanov). **Final pitch: 5 December 2026.**

## 5. Where everything is

| Thing | Where |
| --- | --- |
| Repo | `distillAI-maker/distillV1` (Node 24, pnpm 10.34.6 via `npx -y pnpm@10.34.6`) |
| App | https://distill-app-nu.vercel.app (Next.js, `apps/web`). Class QR: `?src=class` |
| Landing | https://distill-v1-tau.vercel.app (static, `public/`; old page kept at `/v1`) |
| Deploys | Vercel team `distill-dd01`; merging to `main` deploys both in about 1 to 10 minutes |
| Database and auth | Supabase project `hzwiikkttligpmkvondy`. Waitlist table `signups` (Founding 100 emails, `source` = where they joined) |
| AI | Claude API, org "Distill" in the Claude Console ($20 credit, auto-reload off). Opus 5.5 composes and speaks; Haiku 5.5 reads messages |
| Plans and docs | Backend build plan (Claude Doc, Veer shares): https://claude.ai/artifact/H7MtCsMSwm8wapTQcNeuCH · Golden people template: https://claude.ai/artifact/XjczjZ4GA6Fat3w5mhE3DE · In repo: `docs/ENGINE.md` (the engine as built), `docs/ROUTING-V4.md`, `eval/coverage.md`, `eval/reports/` |

Secrets live in Vercel and in each person's `apps/web/.env.local`; never paste or commit them. The Supabase publishable key in `public/assets/js/join.js` and `apps/web/lib/waitlist.ts` is meant to be public.

## 6. What is built (22 October)

- **Landing page** in the new brand system, centred on the personal Ritual, with the "What's on your list?" try-it and the Founding 100 form (#16).
- **App** in the brand system (#17): onboarding (name → tap everything you do → their ideal day → the number: count and monthly cost → invitation with email → connect a wearable or skip), **Your Standard** home with the daily painting, **Today** (today's Ritual), the **companion thread** (text in, reshape out), Settings. Signed-out people can use it all on the phone; sign-in carries their progress into an account (#15, #20).
- **The engine** (#19), built from the build plan. One function, `engine.run(person, event)`, for every event (onboarding, stack change, note, answer, message, night, check-off, edit, decision answer). Rules decide what is cleared, kept and placed; Claude words things and proposes edits; code checks every edit; everything is logged for later ML. Full map in `docs/ENGINE.md`.
- **Routing table V4** (`data/Routing-Table_V4.xlsx` → `data/catalog-v4.json`): 50 rows with sources, evidence tiers A to N with a direction (alcohol's A is evidence of a cost), dose rules, overlaps, safety, and Eat / Move / Mind / Sleep / Skin. **All 50 are `reviewed` (drafted by Claude from opened sources); none is `live` yet.** Rows outside the 50 fall back to V3 as unknown evidence (they never protect or clear).
- **Explore bank** (`data/explore-bank.json`): 60 ideas; **none certified yet**. Only certified ideas are ever shown.
- **Evaluation:** 41 golden people (`eval/people/`: 8 companion examples, 32 drafted by Claude, Veer as `veer-00`), hard gates in `pnpm check`, Claude runs and an Opus judge with planted bad outputs (`pnpm eval:engine`), blind A/B (`pnpm eval:ab`). Rules-only today: all pass every gate; the engine finds 27% of the clears a careful friend would propose (most misses are rows outside the 50).
- **Open PR #21** (Claude's first Ritual and reshapes now land instead of falling back to rules lines): https://github.com/distillAI-maker/distillV1/pull/21. Ishan to review. It adds `pnpm ritual:show <ids> [--claude]`, which prints a person's first Ritual, what Distill proposed, every reply and why any Claude step fell back. Veer's own result with Claude on: creatine with breakfast, meditation daily, sport with friends at 4, wine nights with friends at 7, wind-down at 10; "out late with the team tonight" → "Saturday starts slow: sleep in, then your morning meditation, creatine and vitamin C whenever you're up."

**Not live yet in production:** the engine's tables (migration not applied), four server settings on Vercel, Claude (`ENGINE_CLAUDE` off), any V4 row, any explore idea. Until the settings exist, signed-in screens that call `/api/app/*` answer 503. See priority 1.

## 7. Decisions already made (do not re-open without Veer)

| Date | Decision |
| --- | --- |
| 19 Oct | Voice is the cool, supportive companion, not the museum curator |
| 20 Oct | Distill is the layer of personal Ritual; the Ritual is the whole system |
| 20 Oct | Reshaping must come from the core engine, not a one-off feature |
| 20 Oct | Founding 100 members sign in to get the engine; strangers still get their number on the phone in 60 seconds |
| 20 Oct | One-off reshapes apply at once with Undo; ongoing changes wait for a yes |
| 20 Oct | Nights from a wearable reshape mornings only if the person turns it on (choice first); once on, it adjusts quietly, like Eight Sleep |
| 20 Oct | Their own numbers are fine in lines; never health numbers |
| 20 Oct | Skin is a fifth area; overdoing skincare is a big "simplify"; skin conditions go to a dermatologist (`refer`) |
| 20 Oct | V4 rebuilt from scratch; V3 kept only for the old test code |
| 20 Oct | No tests or verdicts anywhere in the product |
| 20 Oct | The fifth job is **Explore, not recommend**: ask first, offer options from a certified bank, never instruct |
| 20 Oct | No Claude spend before real users beyond small test runs; top up the credit before wave 1 |
| 20 Oct | Message text may be stored to learn from, with consent; Opus for lines people read, Haiku for reading messages |
| 20 Oct | Veer writes the golden people, grounded in real people |
| 21 Oct | The autonomy pillar and the mission above go into every prompt (`apps/web/lib/ai/engine/prompts.ts`, `WHO`) |
| 21 Oct | Every AI output passes code checks and a judge before anyone sees it; a bad response falls back to the rules version, never reaches a person |
| 22 Oct | Lead with the noise and unique identity, not loneliness |

## 8. The five priorities

**1. Make the engine real in production. Owner: Rohan (Ishan for Vercel access). This week.**
- Apply `supabase/migrations/20261021000001_engine.sql` in Supabase.
- On the distill-app Vercel project, add `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`, then redeploy.
- Make sign-in emails arrive: custom SMTP in Supabase (steps in Veer's `distill-brand/email/SETUP-sign-in-email.txt`), the redirect URL `https://distill-app-nu.vercel.app/auth/callback`, and the token_hash template.
- `pnpm engine:backfill --write` so existing testers start from what they told the app.
- **Done when:** a fresh signed-in account on the live app gets a first Ritual and a reply in the companion thread (Claude off is fine).

**2. Make the engine's judgement trustworthy. Owner: Ishan. Next two weeks.**
- Review and merge #21.
- Set the 50 V4 rows `live` with the checklist in `docs/ROUTING-V4.md`.
- Fix the follow-ups in #21: supplements should ride along with breakfast instead of taking one of the three day-one morning places; ask how often (a question card) instead of guessing "once a week".
- When the credit allows, run `pnpm eval:engine --claude --judge --yes` (about $15) and fix what it finds; then the next V4 batch from the report's "Missed clears".
- **Done when:** all golden people pass every gate with Claude on and the judge averages 4 or more of 5.

**3. The first two minutes: value, then their first Ritual. Owners: Veer (taste) with a Claude session (build). Next two weeks.**
- Keep the instant win: tap everything you do, see what's pointless cleared and the money back.
- Then two light questions: "Think of a day you felt completely like yourself. What were you doing, and who was there?" and a few **this-or-that** taps (morning person or night person, set plans or go with the flow, a night out or a night in, nature or city, best work in the mornings or afternoons). Minimal effort, one tap each.
- Then their first Ritual on screen, with "This is my Ritual" and easy edits.
- **Done when:** a stranger at phone size goes from nothing to their own Ritual in about two minutes, and Veer would show it to them.

**4. Prove it is a real problem, and teach the engine our taste. Owner: Veer. Starting now.**
- Ten conversations with people 22 to 35 who spend on wellness. Don't pitch; ask about the last thing a feed sold them, when they feel they're not doing enough, and a day they felt most like themselves. Listen for people lighting up, spending, or hacking their own fixes.
- Rewrite the golden people from real people (the 32 Claude-drafted ones first), using the template doc.
- Be the judge in the blind A/B; certify the explore ideas worth showing (`certified: true` in `data/explore-bank.json`).
- **Done when:** notes from ten conversations, at least eight golden people grounded in real people, and a certified set of explore ideas.

**5. Founding 100 and the 5 December pitch. Owner: Veer, with everyone.**
- When priorities 1 and 2 are done: top up the Claude credit, set `ENGINE_CLAUDE=on` (and `COMPANION_VOICE=v2` after it wins the A/B), invite waves of 25 with member numbers.
- Watch the metric views in the engine migration (first Ritual accepted, weekly active, reshapes kept, clears accepted, cost per member).
- Pitch demo on the live app: tap the stack → the clear → their Ritual → text "out late with the team tonight" → the reshaped Saturday.
- Brand-account content in parallel (films, carousels, "Kept / let go").
- **Done when:** wave 1 is in, and the demo runs live without a hitch.

## 9. How we work

- **Branches and PRs only.** Never push to `main` (it deploys). Claude sessions push branches and open PRs without asking; request Ishan as reviewer; Veer merges.
- **Before saying what the code does,** run `git fetch` and look at `origin/main`. Things move fast; an old checkout has misled a session before.
- **Checks:** `npx -y pnpm@10.34.6 check` (lint, types, about 1,600 tests, catalog, tone) and `build:web` before every PR. The dev server rewrites `apps/web/next-env.d.ts`; never commit it.
- **Useful commands:** `pnpm catalog:build` (V3 and V4), `pnpm eval:gates` (three seconds, free), `pnpm eval:engine` (rules only, free; add `--claude --judge --yes` to spend), `pnpm ritual:show veer-00 --claude` (after #21), `pnpm engine:backfill`.
- **Claude off by default.** Nothing spends without a deliberate flag or setting; the engine works fully on rules and fixed lines.
- **When something breaks mid-task,** fix it properly on the branch or ask one clear question; don't stop at a report.
- **Veer's style:** recommendation first, concise, show don't describe, art-directed visuals over option tables. Phone-size checks for anything people see.

## 10. Known issues and open items

- Production settings and migration (priority 1).
- V4: 0 of 50 live; 160 rows still on V3; 93 V3 rows were never fact-checked.
- Day-one Rituals cap each moment at three parts; supplements compete for those places (in #21's follow-ups).
- Unknown frequencies are guessed as "once a week" when their ideal day doesn't mention the thing.
- The old landing-page test copy is gone; `docs/DIRECTION.md`'s "Look" section (gallery white, gold, Switzer) is superseded by the brand board.
- Business model (membership vs. partners we'd recommend anyway, always labelled) is open.
- Sabrina's ask (one simple sentence, value in 90 seconds) is covered by priority 3.
