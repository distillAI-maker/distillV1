# The engine, as built

This is Veer's "Distill engine: backend build plan" (20 Oct 2026), built end to end on the `ritual-engine` branch, with the algorithm changes we agreed folded in. Everything here runs today with Claude off: rules decide, fixed lines speak, and nothing breaks. Turning Claude on is one setting.

## What it does, in one breath

One function, `engine.run(person, event)`, takes anything that happens to a person (they finish onboarding, change their list, write a note, answer a question, message the companion, sleep badly, check something off, edit their week, answer a proposal) and updates who they are, what Distill proposes, and their Ritual: their mornings, nights and weekends. Rules decide what is cleared, kept and placed. Claude only words things and proposes edits, and code checks every edit before it is saved. Every output is logged with what produced it, so phase 2 can learn from it.

## Where it lives

| Part | Files |
| --- | --- |
| The rules (pure, no I/O) | `packages/engine/src/ritual/`: `types.ts` (every shape), `person.ts` (the person model), `decide.ts` (clear, keep, curate, refer), `questions.ts`, `compose.ts` (rules place every part), `ritual.ts` (versions and edits), `validate.ts`, `dates.ts`, `scope.ts`, `triggers.ts` (short nights, slips), `pick-today.ts`, `explore.ts`, `check-line.ts`, `stamp.ts` |
| Routing table V4 | `data/Routing-Table_V4.xlsx` → `data/catalog-v4.json`, read through `packages/catalog/src/view.ts`. See [ROUTING-V4.md](ROUTING-V4.md) |
| Storage | `supabase/migrations/20261021000001_engine.sql` (five tables, seven metric views), `apps/web/src/server/engine-store.ts` |
| Claude's steps | `apps/web/lib/ai/engine/`: `classify.ts` (Haiku 5.5), `update-person.ts`, `word-decisions.ts`, `compose.ts`, `reshape.ts`, `reply.ts`, `explore.ts` (Opus 5.5), `call.ts` (one retry with the problems listed, then the fallback), `prompts.ts` (the shared voice) |
| The orchestrator | `apps/web/src/server/engine.ts` (`Engine`, `previewEngine`), `engine-deps.ts`, `engine-routes.ts` → `/api/app/engine/*` |
| The app | `apps/web/lib/engine/` (client and shared state), Today (`app/(app)/today/`), the companion thread (`app/(app)/companion/`), Home's one thing (`home/engine-today.tsx`), Settings |
| The evaluation | `eval/people/` (40 people), `apps/web/src/eval/` (runner, hard gates, judge), `apps/web/scripts/eval-engine.ts`, `eval-ab.ts` |

## How a message becomes a changed day

"out late with the team tonight", sent at 18:40 on a Friday:

1. The message is saved to the thread, and the event is logged (its length, never its words).
2. Haiku reads it: a one-off, lighter, tonight. If the words say someone may be in danger, a fixed, human-written reply with 988 and 911 goes back instead, and nothing else happens. A regex backs the model up, so this never depends on Claude.
3. Opus reads what it teaches about them (people, places, feelings about their things). Code keeps only what quotes them.
4. Code works out the dates ("tonight" after midnight is still the night under way) and the scope: a lighter night means a gentler next morning, so Saturday morning is the target. Parts that are theirs, a clinician's, or have their people in them are locked.
5. Opus proposes a reply and edits. Code checks every edit (nothing locked moves, nothing new to buy, the day gets lighter, not fuller) and checks that the reply only describes what was done. Sleeping in, an early night, a rest day and quiet time count as rest, and code names those parts itself, so nothing else can come in as rest. One retry with the problems listed, then a fixed reply and no change.
6. A one-off change is saved as edits on top of the base week for that day, applied at once, with Undo. An ongoing change ("training starts Monday") becomes a proposed new week that waits for their yes.
7. The app shows "Your Saturday, adjusted", the reply, and Undo.

## Events

| Event | What happens |
| --- | --- |
| `onboarding` | Decide, word the proposals, compose the first Ritual (rules, then Claude shapes it). It waits for "This is my Ritual". |
| `stack-change`, `refresh` | Decide again; the week drops parts for things they let go and gives newly kept things a place. |
| `note`, `answer` | Learn from their words, decide again. |
| `message` | As above. Questions and chat get a reply; a stack change ("stopped the AG1") comes back for them to confirm. |
| `decision-answer` | Yes, not now (a cooldown: 21 days, 30 for a habit), or "this is mine" (final). A yes is never asked again. |
| `question-answer`, `confirm` | Their answer to a question card, or their yes to a feeling Distill heard ("is AG1 something you love?"). |
| `night` | Off unless they turned on "Let my nights shape my mornings". Fires when last night was more than two of their own swings below their usual (14 nights at least), at most once every 3 days. |
| `part` | A check-off. Three days of mostly skipped mornings (explicit skips only; silence never counts) offers a lighter morning, as a proposal. |
| `edit` | Their own edit applies at once, no model. |

Question cards always pair words that fit their buttons: the trains and company cards use fixed wording, and the where-did-it-come-from card uses the row's `origin_question` when it has one (the buttons never change). Every card ends in **Not sure**, which changes nothing they told us and rests that question for two weeks. A row's `human_question` is background for Claude, never a card title.

**Follow-ups.** Every card on Today has a **Why?** that opens the companion asking about that thing ("Why let greens powder go?"), with the item attached. The companion knows what a message is about, in this order: the card they tapped, the thing they named, or, for a short follow-up ("why?", "how would I fit that in?"), what they last asked about or today's card, within 12 hours (`message.about` events). The reply then gets the whole item: grade, what each source found (paraphrased), why Distill asks, where it stands for them (keep, let go, still asking), the swap when Distill suggested letting it go, and safety notes only for conditions they told us about. Claude may use up to 90 words here (50 otherwise). With Claude off, a Why? tap or a card follow-up is answered in the catalog's reviewed words (`evidence_summary`, a safety note that applies, and "One swap, if you'd like it: …"); a free-text question naming something still gets the placeholder, since only Claude can fit the answer to them.

**Swaps.** A row with `swap_title` and `swap_slot` has a swap that is a thing to do, never something to buy (chamomile tea for apigenin). It is offered once: on Today right after a yes to letting it go, and in the companion with a reply about something Distill suggested letting go of. Yes adds it to their base week as `part:swap:<key>` (undoable like any edit); no logs `swap.declined` and it never comes back.

Today's one thing (`pickToday`) ranks what's open (a referral, then a clear on a rhythm, adjustments, questions worth asking, explore when the time is right, a daily question), draws fairly among ties with a seed, and logs the chance each had, so the effect can be measured later.

## Switches

| Setting (Vercel, distill-app) | Default | What it does |
| --- | --- | --- |
| `ENGINE_CLAUDE=on` (with `ANTHROPIC_API_KEY`) | off | Claude runs the steps above. Off, every step uses rules and fixed lines. No spend before real people use it. |
| `COMPANION_VOICE=v2` | v1 | The companion's lines (what a habit gives you, "What we've learned") use the engine's voice. Turn on after the blind A/B. |
| `ENGINE_CATALOG_STATUSES` | `live` | Which V4 rows reach people. `live,reviewed` lets a preview read the rows Claude checked before Ishan signs them off. |

Caps: 40 Claude calls and 6 reshapes per person per day; past either, rules answer.

## Tested

- Rules: 54 unit tests, including Veer's three worked examples, order independence, cooldowns, and the safety cases.
- The engine on Postgres (PGlite): 20 tests through the whole loop, with Claude scripted.
- The screens: component tests for Today and Home's one thing.
- The golden set: 40 people (the 8 companion examples and 32 drafted ones) played through onboarding and two weeks of their events. With Claude off, all 40 pass every hard gate: nothing of theirs proposed for clearing, nothing from a clinician touched, no locked part moved, nothing they asked us never to say, every Ritual valid. `pnpm eval:gates` runs this in about three seconds.
- With Claude off, the engine finds 27% of the clears a careful friend would propose. Most misses are rows outside the first 50 V4 rows (sea moss, EMF stickers, BCAAs), which the engine reads as unknown evidence and never clears; the rest need Claude to read "an Instagram mom said" as borrowed. Dermatologist referrals: 2 of 2.
- `pnpm eval:engine --claude --judge --yes` runs the same 40 with Claude and has Opus score each on the plan's eight questions, with four planted bad outputs it must catch. About $15. Not run yet: there's no key on this machine.

## Where it differs from the plan

These are the changes from our review of the plan, plus what building it turned up. Each is a decision for Veer to keep or reverse.

1. **Decide runs in staged passes** (safety, then theirs and loved, then overlaps, then each item's own rules), so the order of someone's list can never change an answer.
2. **A low dose of something well-founded is an adjustment, never a clear.**
3. **Unknown evidence neither protects nor clears.** A V3 row nobody has reviewed is tier U: only "unused" and overlaps apply to it.
4. **"Borrowed" needs their own words**, never the population's ("most people buy this from TikTok"). A downgrade of something loved becomes a question, not a change.
5. **Questions are asked only when the answer changes what Distill does.** Each candidate is run through decide once per possible answer.
6. **Time is a slot plus days.** Morning, night, Saturday and Sunday are views over it, so one part can live on weekdays and weekends.
7. **A changed day is stored as edits on the base week**, and every base week has a start date. A later change to the week still reaches a day changed earlier; edits that no longer apply are dropped and reported. Future weeks get the same upkeep.
8. **Rules place every part; Claude only polishes.** Part ids are stable (`part:<item id>`). Day one stays small (three a moment); a full weekend trims a daily part to weekdays instead of dropping it.
9. **Dates are resolved by code**, with Claude's reading kept only to log disagreements.
10. **A reply may only describe what was done**: no time, day or promise that isn't in the edits.
11. **A slip is explicit skips only**, and seasons ("busy", "travelling") wear off on their own.
12. **Explore opens once there's nothing left to clear** (or nothing to clear at all), a week after their first Ritual, outside busy or unwell seasons, and shows only ideas Veer has certified. Ideas Claude thinks of are saved for review, never shown.
13. **Evidence has a direction.** Tier A for alcohol is evidence of a cost, so it never protects anything.
14. **The blind A/B is 40 pairs, shipping at 26 wins** (the plan said 20 pairs at 60%): 26 of 40 is where a coin flip falls short 5% of the time. The judge gets planted bad outputs, and its scores aren't trusted if it misses one.
15. **Conditions are also read from plain words** without a model: a skin condition ("still breaking out", "a mole that looks bigger"), a pregnancy, breastfeeding. Present tense only, never negated, always with the sentence quoted. This is what lets the dermatologist referral work with Claude off.
16. **Once V4 exists, its overlap sheet is the whole list.** V3's prose rules ("shown, not auto-dropped") were being read as "keep one".
17. **The companion's new voice is behind a switch** until it wins the A/B, so merging this changes nothing people see on the companion lines.
18. **Fixed lines never repeat a name that holds a word Distill never says** ("Detox tea" is "this one" in the sentence, and stays their label on the card).

## Going live, in order

1. Review and merge the PR. Merging deploys the new screens, but Claude stays off and no V4 row is live, and until step 3 the signed-in screens can't reach the server at all.
2. Apply `supabase/migrations/20261021000001_engine.sql` in Supabase (SQL editor, or `supabase db push`).
3. On the distill-app Vercel project, add the four server values still missing: `DATABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TOKEN_ENCRYPTION_KEY`, `CRON_SECRET`. Without them `/api/app/*` answers 503 and the signed-in screens can't load.
4. Ishan reviews the 50 V4 rows and sets them `live` (ROUTING-V4.md has the checklist).
5. `pnpm engine:backfill --write` with `DATABASE_URL` in your shell, so people who onboarded before this start from what they told the app.
6. Veer certifies the explore ideas he has checked (`certified: true` in `data/explore-bank.json`).
7. When it's time to spend: `ENGINE_CLAUDE=on` and `ANTHROPIC_API_KEY`, then `pnpm eval:engine --claude --judge --yes` and `pnpm eval:ab --yes` with Veer and one more reviewer.
