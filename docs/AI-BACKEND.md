# The AI backend: where we are and what's next

23 October 2026. For Veer, Ishan and Rohan, and our Claude sessions. Read `docs/HANDOVER.md` first, then this, then `docs/ENGINE.md` for the detail.

**Goal:** a real person signs in and gets a first Ritual that Claude shaped, that feels like theirs, and that we've measured as good.

## 1. Where we are

Veer's 20 October build plan (the "One engine" diagram: words, stack, nights and messages → person model → decide → compose → reshape → companion voice → app, all logged to `engine_events`) is **built and merged** (#19, #21, #23). Everything runs with Claude off today: rules decide, fixed lines speak.

| Piece | State |
| --- | --- |
| Rules: decide, compose, reshape, safety | Built, tested (54 unit tests, 20 end-to-end on Postgres) |
| Routing table V4 | 156 rows, all live (23 Oct) |
| Claude's steps: read a message (Haiku 5.5); learn, word, compose, reshape, reply (Opus 5.5) | Built, behind `ENGINE_CLAUDE=on`. **Never run on real people.** |
| Code checks on every Claude output, one retry with the problems listed, then the rules version | Built (`apps/web/lib/ai/engine/call.ts`) |
| Crisis words → 988 and a human flag, even with Claude off | Built |
| Golden set: 41 people played through onboarding and two weeks | Built; with Claude off all 41 pass every hard gate, and it finds 27% of the clears it should |
| The judge (Opus scores the plan's eight questions, with four planted bad outputs it must catch) and a blind A/B | Built (`apps/web/src/eval/`). **Never run: it needs a key and about $15.** |
| Server settings on Vercel | Done: `/api/app/*` answers "sign in required", not 503 |
| Engine tables in Supabase (`supabase/migrations/20261021000001_engine.sql`) | Unknown. Check by signing in on the live app and finishing onboarding |
| `ENGINE_CLAUDE` in production | Off |

**So the gap isn't design. It's that Claude has never actually run.** We don't yet know whether its Rituals are good.

## 2. The path, in order

1. **Run Claude on the golden set** (Veer's go-ahead: about $15, from a machine with `ANTHROPIC_API_KEY`): `pnpm ritual:show veer-00 --claude` first (one person, cents), then `pnpm eval:engine --claude --judge --yes`. Output: every person's Ritual, the judge's scores and critiques, which hard gates failed, and why any step fell back. That turns "it sometimes gives bad Rituals" into numbers.
2. **Fix the biggest failure group, then re-run** (Loop 2 below). Repeat until all hard gates pass with Claude on and the judge averages 4 or more out of 5 (HANDOVER priority 2).
3. **Veer hand-grades about 30** of the judge's verdicts. Where we disagree, the judge's rubric changes.
4. **Prove production end to end** (Rohan): a fresh account on the live app signs in, onboards, and sees a first Ritual in Today and a reply in the companion, with Claude off. This confirms the engine tables exist.
5. **Turn Claude on** for us first (`ENGINE_CLAUDE=on`, top up the credit), then wave 1 of the Founding 100.

## 3. The quality loop (the 23 Oct handover), mapped to what exists

| Loop | Already built | Still to build |
| --- | --- | --- |
| **Hard checks in code** (interactions, doses, locks, evidence) | Yes: decide's safety pass, `validate.ts`, `check-line.ts`; V4 carries doses, safety and evidence direction | Nothing for now |
| **Loop 1, in the moment:** draft → check → critique → rewrite → fallback | Code checks, one rewrite with the problems listed, then the rules version | A judge at runtime for the **first Ritual only** (it's made once, so the cost is fine): score it, rewrite once on a fail, else use the rules version. Optional: draft 3, keep the best |
| **The judge** | Offline, on the golden set, with planted bad outputs as a calibration check | Veer's ~30 hand grades; try a different model as judge to reduce self-grading leniency |
| **Loop 2, fix the prompt:** cluster failures → fix the biggest → re-run, keep only if nothing gets worse | The golden set, the runner and the gates make this possible today | A short script that groups the judge's critiques; prompt changes versioned (each Claude step already carries a `PROMPT_VERSION`) |
| **Loop 3, examples library:** put 2–3 Rituals from similar people in the prompt | No | Once real people keep Rituals unchanged for 2–3 weeks. Until then, the hand-approved golden Rituals are the library |
| **Behaviour as the signal** (keep, swap, edit, skip) | Every event is logged to `engine_events` with what produced it; check-offs, edits, undos and answers are events | Metric views exist in the migration; Ishan's ML reads these later |

## 4. The ideas on the table

- **"Ask the Claude that has last night's context."** That context is in the repo: `docs/ENGINE.md` (the engine as built), `docs/HANDOVER.md` (decisions), `eval/reports/` and this file. Point any Claude session at these three files and it has it.
- **Five personality types as the base.** Recommendation: not as boxes people are put in. A type makes everyone in it get the same Ritual, which is the opposite of "unique". Use them in two other ways instead:
  1. **A few axes, not types**, from taps people already make: up early or late, set plans or go with the flow, a night out or a night in, best work in the morning or afternoon (HANDOVER priority 3), plus the study's answers (wake time, most days, what they reach for, what goes first, who they want more time with). These feed the person model directly.
  2. **Archetypes for testing**: make sure the golden set covers each kind of person, and later pick the 2–3 nearest kept Rituals as examples (Loop 3).
- **RAG.** Our data is small and structured (156 V4 rows, one person's history), so it already goes straight into the prompt; retrieval would add moving parts without adding knowledge. The one place retrieval helps is Loop 3: finding the most similar people's kept Rituals. That's a later step, after real people have kept Rituals. Agreed: not a priority now.
- **Which model judges.** Opus 5.5 composes. A judge from a different model grades less leniently; try one against Veer's hand grades and keep whichever agrees with him more.

## 5. Decisions needed

| Decision | Who |
| --- | --- |
| Spend about $15 to run Claude on the golden set (step 1) | Veer |
| Add a runtime judge for the first Ritual | Ishan, after step 1 shows how often Claude fails |
| Confirm the engine tables exist in Supabase (step 4) | Rohan |
| When Claude goes on for us, and then wave 1 | Veer |
