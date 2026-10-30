# Distill: team handover

27 October 2026. Replaces the 22–23 October version. For Veer, Ishan and Rohan, and for each of our Claude sessions.

**If you are a Claude session:** read this whole file first. Then read `docs/ENGINE.md` (the engine as built), `docs/AI-BACKEND.md` (the path to Claude shaping real Rituals) and `eval/review/the-41-fixes.md` (the open product fixes). Where this file and an older doc disagree, this file wins. Before saying what the code does, run `git fetch` and read `origin/main`.

**Where we are, in five lines:**
1. The landing page, the app and the engine are live. The engine runs on rules, with Claude switched off.
2. The 156-row routing table is live and has been checked twice: every source, then an independent re-check.
3. Veer has reviewed all 41 test people and confirmed them as good data (27 October). His notes became product-wide rules, all merged in PR #45.
4. **Next:** run Claude on the 41. Veer has approved the ~$15. Fix what fails and run again until every gate passes and the judge averages 4 or more out of 5.
5. **In parallel:** prove the live app end to end for a signed-in person (Rohan), and the first two minutes of the app (Veer).

---

## Contents

1. [What Distill is](#1-what-distill-is)
2. [The mission test every change must pass](#2-the-mission-test-every-change-must-pass)
3. [Voice and words](#3-voice-and-words)
4. [Brand](#4-brand)
5. [Team and ownership](#5-team-and-ownership)
6. [Where everything is](#6-where-everything-is)
7. [What is built](#7-what-is-built)
8. [How Distill decides, in plain words](#8-how-distill-decides-in-plain-words)
9. [The catalog (routing table V4)](#9-the-catalog-routing-table-v4)
10. [The 41 test people](#10-the-41-test-people)
11. [Decisions already made](#11-decisions-already-made)
12. [The priorities, in order](#12-the-priorities-in-order)
13. [Open product fixes](#13-open-product-fixes)
14. [How we work](#14-how-we-work)
15. [Known issues](#15-known-issues)
16. [Start here: Ishan's Claude, Rohan's Claude](#16-start-here-ishans-claude-rohans-claude)
17. [Glossary](#17-glossary)

---

## 1. What Distill is

**One line:** your unique personal Ritual, so you are free to live the rest of your life on your own terms. Sign-off: "Less noise. More you."

**The problem:** this is the most connected, most marketed generation there has been. Feeds, influencers and endless buying tell people what to take, track and become, and leave them feeling they are never doing enough or never good enough. Wanting to reach your potential is beautiful; the point is to be content while you chase it, and that only comes from your own journey.

**What we do:** Distill builds each person's **Ritual**: the whole system of their mornings, days, evenings, nights and weekends, shaped around who they are. Five jobs, in order:

1. **Clear the noise.** What came from a feed, an ad or someone else's routine and does nothing for them is let go, on evidence (routing table V4).
2. **Know them.** Their words (ideal day, notes, answers), their stack (what they do and spend), their data (wearables). This builds over time.
3. **Shape their Ritual.** Mostly things they already do and love, organised. Values beat data.
4. **Reshape it with life.** A property of the engine, not a feature. They text "out late with the team tonight" and get a warm reply and a slower Saturday.
5. **Explore outward.** Once it feels like theirs, Distill **asks** what they want to try (a region, a skill, a scene, new people) and offers a few real options. It never tells them what to do.

**Positioning (Veer, 23 Oct):**
- **The bigger problem is mental health.** The noise leaves people overwhelmed, anxious and never feeling like enough. That's the wider issue under everything we build, and a huge market. Distill isn't a session you open when it gets bad (Calm, Headspace). It's the system underneath your days, so there's less of it to begin with.
- **We lead with the noise.** It's the pain someone recognises in a second ("There's so much noise"), it comes with a dollar amount, and it's what the first 60 seconds solve. Clarity, calm and feeling like enough are what people find as they go deeper.
- **How we stand in mental health:** a wellness companion, not therapy or care.
  - Never claim to treat, cure or diagnose anything, and never speak to anyone as a patient.
  - Someone struggling or in crisis is pointed to a professional or a crisis line. Crisis words get the 988 line and a flag for a human, even with Claude off (`apps/web/lib/ai/engine/reply.ts`, `classify.ts`).
  - Not a medical product.
- **Loneliness:** connection comes as a result (people count; explore pushes into real life). It helps without being the pitch.

**The autonomy pillar (Veer, 21 Oct):** like a great phone, people use Distill their own way, never a route they are pushed down. It should feel freeing: finally thinking from your own head. Everything is a proposal, "This is mine" is final, and there are no streaks, scores, targets or guilt.

**What it is not:** a lab, a coach with targets, a feed, biomarker personalisation, or medical advice. Anything from a clinician is never touched. There are no tests or verdicts on screen; the old 28-day test engine stays in the code, switched off.

**The beliefs underneath (Veer, 23 Oct):**
1. A good life comes from taking away, not adding (Epicurus, the Stoics, Buddhism) → **clear the noise.**
2. Live by your own judgement, not the crowd's (the Stoics, Emerson) → **what's yours.**
3. Character is what you do every day (Aristotle) → **your Ritual.**

Self-determination theory (Deci and Ryan) says the same: autonomy ("it's yours"), competence (a Ritual you can actually live) and relatedness (the people in your Ritual). The philosophy is Distill's soul (brand, content), not the pitch. People buy relief from a pain they feel this week.

**The wedge, our first market (Veer, 23 Oct):**
- **Who:** 22 to 35, in US cities, spending $100 or more a month on supplements, protocols and wellness apps they picked up from feeds and podcasts.
- **Their pain, in their words:** "I'm doing, and paying for, too much, and I don't know what's actually worth it."
- **First value, live now:** tap what you take and do, see what can go and the money back. That's the landing page's "What's on your list?" and the app's onboarding, both on the engine.
- **Then outward:** clear the noise → their Ritual → reshape it with life → explore.
- **Not the wedge:** career change, productivity tools, loneliness communities.

## 2. The mission test every change must pass

Veer, 25 October, after a session spent tuning small rules:

> At the core, the most important part of our product is creating the user's unique personal Ritual that is fully them, and that adapts on the fly to keep anxiety down and keep them feeling confident: growth mindset and human exploring. We don't try to perfect their routine; human life is never like that. We keep them going, with the base as good as possible from what they value and their goals.

In practice, Distill has two jobs:
- **The base:** their usual week, built from what they value and their goals, as good as it can be. Advice about habits (a swap, an anchor, a budget option) belongs here, offered once.
- **The day:** life happens. A late Friday and a hungover Saturday with good memories is a life, not a slip. Distill never corrects a night after the fact. It encourages them and reshapes the day from that point on.

**The test:** if a change makes Distill feel like it's policing someone's life or chasing perfection, it's wrong.

**Trust (Veer, 25 Oct):** the question cards and the background Claude uses (each row's `human_question`) are fundamental. Distill asks what something means to the person before it suggests anything.

## 3. Voice and words

- **Voice:** a cool, supportive companion. A friend deep into wellness who is genuinely excited about your life: warm, direct, a little playful, specific, honest, full sentences. Test: would a friend say it over coffee?
- **"Ritual" is the whole system, never one habit.** Say "your Ritual", "part of your Ritual". Never "a ritual" or "rituals".
- **Rules:**
  - no exclamation marks, no emoji
  - second person ("you"), never "they/their" about the reader
  - never "should / must / need to"
  - none of the banned words (`catalog.toneRules`; the code enforces this through `toneLint` and `checkLine`)
- **Evidence rule:** never talk down a well-founded thing someone does (creatine) because they can't feel it.
- **Numbers:** their own times and money are fine ("see you at 10", "$90 a month back"). Never health numbers, scores or study figures.
- **Letting go is said with confidence, once** (Veer, 27 Oct): "AG1 came from someone else's routine, and nothing you've told us ties it to your days. It can go: $79 a month back." It's a statement, not a question. Their answer decides.
- **Swaps never presume** why someone does something ("when it's mostly the fizz" was wrong). They keep the part people like, and look upstream: a late Monster usually patches short sleep.

## 4. Brand

- **Source of truth:** Veer's Figma brand board (`distill-brand/figma-board-v1`, ask Veer).
- **Palette:** ground `#f0ece2`, parchment `#ddd3bf`, travertine `#b9a98f`, olive `#6d7052`, ochre `#b4833e`, **persimmon `#f26342`** (the one loud accent), walnut `#4a3126`, umber `#2b211c`, ink `#11191b`.
- **Type:** Newsreader light for display, Source Sans 3 for the interface. **Mark:** the eight-point chisel star.
- **Classical art sits underneath, lightly:** a daily public-domain painting with a museum placard on Your Standard. Never tacky: no fake quotes, no Greek words, no columns or laurels.
- **Product first:** very few words on the landing page and in the app. The long brand story belongs in content.
- **Marketing** comes from a Distill brand account, never founders' faces.

## 5. Team and ownership

| Person | Owns | GitHub |
| --- | --- | --- |
| **Veer Benepal** | Product, taste, brand, marketing. Reviews and merges PRs. Makes the catalog and rule calls (he has since 23 Oct). | `veerbenepal` |
| **Ishan Vannadil** | The engine's logic and ML, routing table V4, evaluation. Vercel team owner. | `ivannadil`, `distillAI-maker` |
| **Rohan Jain** | Backend: Supabase, the API, data, deploy settings. | |

- **Reviews (Veer, 25 Oct):** for now, PRs don't request Ishan as reviewer. Veer reviews and merges. Changes in Ishan's area (engine, V4) or Rohan's (Supabase, API, deploy settings) are still **named in the PR description**, so they can see them.
- **Class:** AI-Assisted Product Development (Sabrina Romanov). **Final pitch: 5 December 2026.**

## 6. Where everything is

| Thing | Where |
| --- | --- |
| Repo | `distillAI-maker/distillV1`. Node 24, pnpm 10.34.6 via `npx -y pnpm@10.34.6` |
| App | https://distill-app-nu.vercel.app (Next.js 16, `apps/web`). Class QR: `?src=class` |
| Landing page | https://distill-v1-tau.vercel.app (static, `public/`; the old page is kept at `/v1`) |
| Deploys | Vercel team `distill-dd01`. Merging to `main` deploys both the app and the landing page in about 1 to 10 minutes |
| Database and auth | Supabase project `hzwiikkttligpmkvondy`. Waitlist table `signups` (Founding 100 emails; `source` is where they joined) |
| AI | Claude API, org "Distill" in the Claude Console ($20 credit, auto-reload off). Opus 5.5 composes and speaks; Haiku 5.5 reads messages |
| Engine docs | `docs/ENGINE.md` (the engine as built), `docs/AI-BACKEND.md` (the path and the quality loop), `docs/ROUTING-V4.md` (the catalog's columns), `docs/CATALOG-VALIDATION.md` (how we checked it) |
| Evaluation | `eval/people/` (the 41), `eval/coverage.md`, `eval/reports/` (latest: `2026-10-28-rules.md`), `eval/review/people.json` (`pnpm golden:review`), `eval/review/the-41-fixes.md` |
| Review pages (claude.ai, private to Veer; ask him to share) | The 41: https://claude.ai/artifact/BPBjLLhHFhN8pgoL2wtV1t · Catalog Words: https://claude.ai/artifact/Ue6phUq7oXn1uNiG8gGyKa · Backend build plan: https://claude.ai/artifact/H7MtCsMSwm8wapTQcNeuCH · Golden people template: https://claude.ai/artifact/XjczjZ4GA6Fat3w5mhE3DE |

Secrets live in Vercel and in each person's `apps/web/.env.local`. Never paste or commit them. The Supabase publishable key in `public/assets/js/join.js` and `apps/web/lib/waitlist.ts` is meant to be public.

## 7. What is built

### The landing page (`public/`)
- Opens on a fully black screen, then the noise words fly at you, slowly enough to read (#30, #32).
- Says plainly what Distill does.
- **"What's on your list?"** runs on the app's engine through `POST /api/try` (#31), so it always agrees with the app. It's live: AG1 from a feed comes back as "go", with "$90 back".
- The Founding 100 form takes an email.

### The app (`apps/web`)
Restyled from Veer's Figma design (#25, #27, #28).

**Onboarding, in seven steps:**
1. the noise opener
2. their name
3. tap everything you do
4. the number: count and monthly cost
5. the private study, seven quick questions
6. their first Ritual ("Your Ritual.")
7. an invitation with email, then connect a wearable or skip

**After onboarding:**
- **Four tabs:** Today, Distill (the companion), Standard, Settings.
- **Today** shows today's Ritual plus *one card a day*: a decision or a question, picked by `pick-today.ts`, never the same one within 5 days.
- **The companion thread:** text in, reshape out. **Why?** opens it about one thing; "Or tell me in your words" lets someone answer a card in their own words.
- **Signed out,** people can use it all on the phone. **Sign-in** carries their progress into an account (#15, #20).

### The engine (`packages/engine`, `apps/web/src/server/engine.ts`, `apps/web/lib/ai/engine/`)
- **One function for every event:** `engine.run(person, event)` handles onboarding, a list change, a note, an answer, a message, a night, a check-off, an edit, a decision answer and a question answer.
- **Rules decide** what is cleared, kept, adjusted and placed (`decide.ts`, `compose.ts`, `questions.ts`). Claude only words things and proposes edits, and code checks every edit (`validate.ts`, `check-line.ts`). Everything is logged to `engine_events` for later ML. Full map in `docs/ENGINE.md`.
- **Claude's steps:** read a message (Haiku); learn, word decisions, compose, reshape and reply (Opus). Each step is versioned (`PROMPT_VERSIONS` in `prompts.ts`: `word-decisions@4`, `reply@4`, and so on). Each output is checked, retried once with the problems listed, then falls back to rules. **Claude has never run on a real person.**

### What changed since the 23 October handover (PRs #34–#45)

| PR | What |
| --- | --- |
| #34 | `docs/AI-BACKEND.md`: where the AI backend is, the path, the quality loop |
| #35 | `pnpm golden:review`: the 41 laid out for review |
| #36 | **Catalog validation:** every source checked (code: Crossref, PubMed, the web), an independent Opus re-check of all 156 rows ($6.84), and its fixes: 38 summaries, 35 "instead" lines, 11 tiers |
| #37 | `pnpm catalog:review`: the 48 rows Distill can suggest dropping, in a member's words (reviewed by Veer as "Catalog Words") |
| #38 | **Question cards:** words that fit the buttons, "Not sure" on every card (it rests the question two weeks and changes nothing), and the where-from card in each row's own words (`origin_question`) |
| #39 | **Follow-ups:** Why? on every card; the companion remembers which card; fuller answers (the grade, what each source found, the swap, safety notes that apply to them); swaps you can add to your Ritual (`swap_title`, 17 rows) |
| #40 | **Habits that cost them:** a swap offered whether or not they enjoy it, unless it's theirs |
| #41 | **"Can you feel it doing something?"** for paid mixed-evidence things; no more "stays" cards for no reason; The 41 shows Distill's next questions |
| #42 | **The 41, closer to real life:** nights out, each person's own usual sleep, Ravi's wearables, the energy-drink swap |
| #43 | **Consistency:** anchor well-founded things done now and then to something they already do daily (`builds`, 14 rows) |
| #44 | **Smarter question cards:** one per thing at a time, "feel" never for services, "Or tell me in your words"; the review written up |
| #45 | **Letting go said firmly once,** a week-later check-in, budget options unless loved; the power report refreshed. **#45 carried #39–#44 into `main`** (merged 27–28 Oct) |

**Tidy-up:** PRs #39–#44 still show as open on GitHub, but their work is in `main` through #45. Close them, and don't merge them.

### Production state
- **Server settings:** in. `/api/app/*` answers "authentication required", not the old 503.
- **Engine tables in Supabase** (`supabase/migrations/20261021000001_engine.sql`): **unknown.** Confirm by signing in on the live app and finishing onboarding.
- **Sign-in emails** (custom SMTP, redirect URL, token_hash template): **unconfirmed.**
- **`ENGINE_CLAUDE`:** off. **Explore ideas:** none certified, so none are shown.

## 8. How Distill decides, in plain words

`docs/ENGINE.md` has the full detail. This is what a Claude session needs to hold in its head.

**What decides, in order of authority:** safety first (anything from a clinician is outside the edit), then who they are and what they value, then their season, then their body's signals, then the evidence.

### Evidence grades (each catalog row)

| Grade | Meaning | What Distill does |
| --- | --- | --- |
| **A** | Several consistent trials in healthy adults | Protects it when done regularly, even unfelt |
| **B** | Trials agree but small or narrow | Protects it when done regularly |
| **C** | Studies disagree, or small and short | Their values decide. If it costs money, asks "Can you feel it doing something for you?" |
| **D** | Mechanism, animal studies or anecdote | Can go if it's borrowed (a feed, an ad) and not loved |
| **N** | No independent studies (brand-funded counts as none) | Same as D |
| **U** | Not in the reviewed catalog (old V3 rows) | Never cleared, never protected |

Some grades are **for a cost**, not a benefit: late coffee, energy drinks, evening drinks and nicotine are A or B because the evidence that they hurt sleep is strong. The review page marks these "cost". A row can also be strong only for some people (`evidence_requires`): creatine is A for people who train and C for everyone else.

### What Distill can say about a thing

| Kind | Reason codes | Example line (Claude off) |
| --- | --- | --- |
| **Let it go** (clear) | `BORROWED_WEAK`, `OVERLAP`, `UNUSED`, `DOSE_BELOW_MIN`, `FORM_NOT_ABSORBED`, `NOT_TRAINING`, `TOO_MANY_STEPS`, `NOT_FELT` | "AG1 came from someone else's routine, and nothing you've told us ties it to your days. It can go: $79 a month back." |
| **A swap** (clear, kept on their list) | `UNLOVED_HABIT` | "A swap for Monster: a smaller can before 2pm, and an earlier wind-down, so the afternoon dip asks for less caffeine. You keep the part you like, with less of what it costs you. Want to try it?" |
| **Keep** | `THEIRS`, `LOVED`, `EVIDENCE_REGULAR`, `TRAINS` | "Creatine is doing real work for your training, even when you can't feel it. Keep it." |
| **Shape it** (curate) | `PAIR`, `BUDGET`, `ADJUST_DOSE`, `ADJUST_FORM`, `ANCHOR`, `WORTH_A_LOOK` | "Creatine works best when it's every day. Want it next to your morning coffee or breakfast, so it happens without thinking?" |
| **A professional** (refer) | `SEE_A_DERMATOLOGIST`, `SEE_A_CLINICIAN` | "With your skin flaring like that, a dermatologist is the one to ask." |

`NOTHING_TO_CLEAR` means "no reason to change it yet". It gets **no card**, and the app shows it as their call, not kept.

### The rules Veer set, 24–27 October

1. **Doubt protects.** Unknown evidence, or not knowing what something means to them, never leads to a let-go. Distill asks first.
2. **Habits that cost them** (late coffee, energy drinks, evening drinks, nicotine, A or B for a cost):
   - Enjoying it doesn't change the advice. Distill offers a swap once, for their usual week, keeping the part they like.
   - **Held back only when it's theirs:** "This is mine", "Mostly with people I love" on the company card, or their own words tying it to **people, a tradition or their job** (`tiedToTheirLife`: "wine nights with friends", "shop tradition", "it's literally my job", "Sam and I").
   - These are never told they "stay", never planned into the Ritual unless theirs, and never the anchor of a week. A yes keeps them on the list and frees no money.
   - Mixed-evidence cost habits (a late dinner, dessert, late email, the sleep score) still follow their values.
3. **A night that already happened is never corrected.** The day adapts from there.
4. **Mixed evidence that costs money:** "Can you feel it doing something for you?" "Not really" offers the let-go (`NOT_FELT`). It's never asked about services or apps (meal delivery, a macro app, a class).
5. **Consistency:**
   - Well-founded things that build with daily use (`builds`: creatine, vitamin D, sunscreen, morning light, meditation) and are done on fewer than about 20 days a month get an anchor offer (`PAIR`).
   - The anchor is something they truly do every day at that time. Things you swallow pair with food or drink. Otherwise it's the moment itself.
   - A yes marks it `paired`, and the Ritual places it there every day.
   - Never for things that work on the day (pre-workout, an eye mask).
6. **Letting go, firmly once:**
   - The card's buttons are **Let it go** and **Why?**, with *Not now* · *This is mine* quieter.
   - On pushback, explain properly, then respect their answer.
   - **A week after "Not now",** one check-in: "How's AG1 been going?" *Really good* keeps it, *Honestly, not much* brings the let-go back, *Not sure* changes nothing.
7. **Budget options:**
   - Something $100+ a month with a catalog `budget_option` gets one offer (`BUDGET`): "Equinox is $260 a month. If you'd like it lighter on your wallet: …".
   - **Never when they love it:** a tap, their words ("I'd sell the restaurant before I give that up"), someone they named ("with Dani"), or their ideal day.
8. **Safety always wins, quietly:**
   - Never touch what a doctor gave them (a CPAP, a prescription).
   - A safety note is said only if it applies to a condition they told us about, once, plainly, pointing to their doctor.

### Question cards
- **One a day on Today. One per thing at a time,** most at stake first. Order per thing: check-in, where it came from, how often, do you train, the company question, can you feel it.
- **Every card ends in "Not sure"** (changes nothing; the question rests two weeks) and offers **"Or tell me in your words"**.
- A card is only asked if one of its answers would change what Distill does (`valuableQuestions`).

### Follow-ups (the companion)
- **Why?** on any card asks the companion about that thing.
- **What a message is about,** in order: the card they tapped, the thing they named, or, for a short follow-up ("why?", "how would I fit that in?"), what they last asked about or today's card (12 hours).
- **The answer:**
  - With Claude on, up to 90 words, with the grade, what each source found, the swap and any safety note that applies.
  - With Claude off, a Why? gets the catalog's reviewed words. A statement ("I eat maybe half of them") is thanked.
- **Swaps you can add** (`swap_title`, 17 rows: chamomile tea for apigenin, a worry list for 5-HTP) are offered once, after a yes to letting go. A yes adds it to their week.

### Switches (Vercel, distill-app)

| Setting | Default | What it does |
| --- | --- | --- |
| `ENGINE_CLAUDE=on` (+ `ANTHROPIC_API_KEY`) | off | Claude runs its steps. Off, rules and fixed lines run everything. **Veer decides when this goes on.** |
| `COMPANION_VOICE=v2` | v1 | The companion's older lines use the engine's voice. On after the blind A/B. |
| `ENGINE_CATALOG_STATUSES` | `live` | Which catalog rows reach people. All 156 are live. |

Caps: 40 Claude calls and 6 reshapes per person per day; past either, the rules answer.

## 9. The catalog (routing table V4)

- **Files:** `data/Routing-Table_V4.xlsx`, built into `data/catalog-v4.json` by `pnpm catalog:build`. Read through `packages/catalog/src/view.ts`. Validated by `validate-v4.ts`, which names the sheet, row and column of any problem.
- **156 rows, 463 sources, all `live`** (signed by Veer, 23 Oct). Grades: 23 A, 21 B, 75 C, 21 D, 16 N. The other 54 items the app knows are V3 only, and read as unknown evidence (U).
- **Columns added this week:**

| Column | Rows | What it does |
| --- | --- | --- |
| `origin_question` | 37 | The where-from card in the row's own words |
| `swap_title`, `swap_slot`, `swap_per_week` | 17 | A thing to do that can be added to the Ritual, never something to buy |
| `builds` | 14 yes | The benefit builds with daily use, so consistency matters |
| `budget_option` | 11 | The same activity for less, for something expensive |

- **Validation** (`docs/CATALOG-VALIDATION.md`):

| Step | What | State |
| --- | --- | --- |
| 1 | Every source is real | Done: none retracted |
| 2 | An independent re-check | Done: 81 fine, 75 worth a look, none wrong, fixes applied |
| 3 | Veer reads the person-facing words | Done ("Catalog Words": smart enough for now) |
| 4 | **A qualified expert** spot-checks the tiers, the 218 safety rows and five flagged rows (psyllium, electrolytes, ashwagandha forms, zinc dose, gua sha wording) | **Not done: needs a contact from Veer** |

- **Tabled:** the 17 swaps have no expert check or evidence of their own. Until then a swap "keeps the part you liked", never "is better for you".
- **Read me sheet:** the workbook's "Read me" sheet explains every column. Columns are read by header text, so they can move freely; never rename a header.

## 10. The 41 test people

- **Who they are:** `eval/people/*.json`. There are 8 companion examples, 32 drafted by Claude and Veer as `veer-00`. Each has their list, their words, two weeks of events, and an answer key: what should go, what must stay, who should see a professional, what to never say, and what to mention.
- **Veer reviewed all 41** on the review page (27 Oct) and confirmed them as **good data**. His "not quite" notes were product-wide, recurring issues. They're written up in `eval/review/the-41-fixes.md`, and most are built (section 13).
- **Changes during review:**
  - **Nights out:** seven people go out now, and six send a "going out tonight" message, which tests reshaping the morning after.
  - **Usual sleep:** each wearable person has their own usual night (`usualSleepMin`, 5h 40m to 7h 15m). The test plays four weeks of these, then one short night.
  - **Realism fixes:** Ravi switched from WHOOP to Oura, and Veer's own drinks are tied to friends.
- **Rules only, today** (`pnpm eval:engine`, report `eval/reports/2026-10-28-rules.md`):
  - All 41 pass every hard gate.
  - The engine finds **49%** of the clears a careful friend would propose (up from 27% on 23 Oct).
  - Dermatologist referrals: 100%.
  - People and places named: 50%, which is Claude's job.
- **Most remaining misses** are mixed-evidence things the scripts never answer the "feel" card for, rows still on V3 (Owen's and Andre's glucosamine), or things only Claude can read from their words.
- **Hard gates** (`apps/web/src/eval/golden.ts`, `pnpm eval:gates`, about 3 seconds, free):
  - nothing of theirs proposed for clearing
  - nothing from a clinician touched
  - no locked part moved
  - nothing on their never-say list
  - every Ritual valid
- **With Claude** (`pnpm eval:engine --claude --judge --yes`, about $15): Opus judges each person on the build plan's eight questions, with four planted bad outputs it must catch. **Not run yet. Veer approved it on 27 Oct.**

## 11. Decisions already made

Don't re-open these without Veer.

| Date | Decision |
| --- | --- |
| 19 Oct | Voice is the cool, supportive companion, not the museum curator |
| 20 Oct | The Ritual is the whole system; reshaping comes from the core engine; no tests or verdicts anywhere |
| 20 Oct | Founding 100 members sign in to get the engine; strangers still get their number on the phone in 60 seconds |
| 20 Oct | One-off reshapes apply at once with Undo; ongoing changes wait for a yes |
| 20 Oct | Nights reshape mornings only if the person turns it on |
| 20 Oct | Skin is a fifth area; skin conditions go to a dermatologist |
| 20 Oct | The fifth job is Explore, not recommend: ask first, a certified bank, never instruct |
| 20 Oct | Message text may be stored to learn from, with consent. Opus for lines people read, Haiku for reading messages |
| 21 Oct | The autonomy pillar and the mission go into every prompt (`WHO` in `prompts.ts`) |
| 21 Oct | Every AI output passes code checks before anyone sees it; a bad one falls back to the rules version |
| 23 Oct | Mental health is the bigger problem; we lead with the noise; a wellness companion, never therapy |
| 23 Oct | The wedge: 22–35 in US cities spending on wellness from feeds |
| 23 Oct | All 156 V4 rows are live, signed by Veer; Ishan's sign-off isn't required |
| 23 Oct | The landing page's list runs on the app's engine |
| 24 Oct | Evidence that holds only for a group (melatonin, a light box, a dietitian, acupuncture) is C for everyone; C is never pushed |
| 24 Oct | Grades moved for accuracy after the re-check (sunscreen and retinoids A→B; a consistent wake time, paper reading, earplugs B→C) |
| 25 Oct | **Veer decides when Claude goes on** (`ENGINE_CLAUDE`). PRs don't request Ishan for now |
| 25 Oct | Catalog Words is good enough for now; the swaps' evidence check is tabled |
| 25 Oct | **The mission test** (section 2): the base, never the night; never police or perfect |
| 25 Oct | Habits that cost them: a swap whatever they feel, unless theirs; their words tying it to people, a tradition or their job make it theirs; drinks with friends are left alone |
| 25 Oct | "Gently" means: a question, keep what they love, one plain reason, once at a calm moment, their answer holds, safety the exception |
| 26 Oct | Paid mixed-evidence things get "Can you feel it?"; "no reason to change" is their call, not kept |
| 26 Oct | The test set should look like real life: people go out; usual sleep around 6–7 hours, varying by person |
| 27 Oct | Consistency is a reason things don't work: anchor well-founded daily things to what they already do |
| 27 Oct | **The 41 is good data.** Run Claude on it (about $15) |
| 27 Oct | Letting go is said firmly once, then their answer is respected; one check-in a week after "Not now" |
| 27 Oct | **Budget options** for expensive things, unless they love it. Replaces the 24 Oct "never push a cheaper version of something premium" |

## 12. The priorities, in order

**1. Run Claude on the 41, and fix it until it's good. Owner: Ishan (or a Claude session) with Veer. Now.**
- From a machine with `ANTHROPIC_API_KEY` in `apps/web/.env.local` (Veer's main checkout has one; anyone else needs a key from the Claude Console, org "Distill"):
  1. `pnpm ritual:show veer-00 --claude` first (one person, cents)
  2. `pnpm eval:engine --claude --judge --yes` (all 41, about $15)
- **What you get:** every person's Ritual, the judge's scores and critiques, which gates failed, and why any step fell back to rules.
- **Then** group the failures, fix the biggest group (prompt first, rules second), re-run, and keep a change only if nothing gets worse.
- **Veer hand-grades about 30 verdicts.** Where he disagrees with the judge, the rubric changes.
- **Done when:** all 41 pass every gate with Claude on, and the judge averages 4 or more out of 5.

**2. Prove the live app end to end. Owner: Rohan. This week.**
- Confirm the engine tables exist (`supabase/migrations/20261021000001_engine.sql`). If not, apply them.
- Make sign-in emails arrive:
  - custom SMTP in Supabase (Veer's `distill-brand/email/SETUP-sign-in-email.txt`)
  - the redirect URL `https://distill-app-nu.vercel.app/auth/callback`
  - the token_hash template
- `pnpm engine:backfill --write`, so existing testers start from what they told the app.
- **Done when:** a fresh account signs in, onboards, and sees a first Ritual, a card on Today and a reply in the companion (Claude off is fine).

**3. The first two minutes. Owners: Veer (taste) with a Claude session (build). Next two weeks.**
- Keep the instant win: tap everything you do, see what can go and the money back.
- **Then two light questions:**
  - "Think of a day you felt completely like yourself. What were you doing, and who was there?"
  - a few this-or-that taps: morning or night person, set plans or go with the flow, a night out or a night in, nature or city
- **New (27 Oct):** ask once how much they want to spend on wellness a month, so price becomes a reason.
- Then their first Ritual, with "This is my Ritual" and easy edits.
- **Done when:** a stranger at phone size gets to their own Ritual in about two minutes, and Veer would show it to them.

**4. Prove it's a real problem, and ground the engine in real people. Owner: Veer.**
- **Ten conversations** with people 22–35 who spend on wellness. Ask about the last thing a feed sold them, and when they feel they're not doing enough.
- **Rewrite test people from real people,** the 32 Claude-drafted ones first. Mei, Linda and Naomi already need it (section 13).
- **Certify explore ideas** (`certified: true` in `data/explore-bank.json`).
- **Find the expert** for catalog step 4.

**5. Founding 100 and the 5 December pitch. Owner: Veer, with everyone.**
- **When 1 and 2 are done:** top up the credit, set `ENGINE_CLAUDE=on` (team first), then invite waves of 25.
- **Watch the metric views** in the engine migration: first Ritual accepted, weekly active, reshapes kept, clears accepted, cost per member.
- **The demo:** tap the stack → the clear → their Ritual → text "out late with the team tonight" → the reshaped Saturday.

## 13. Open product fixes

The full list, with who raised each, is in `eval/review/the-41-fixes.md`.

| Fix | State | Needs |
| --- | --- | --- |
| **Look upstream** (Aaron): late caffeine patches short sleep; link the swap to their sleep in the base | Words done | Claude on: prompt + compose |
| **Rewrite Mei, Linda, Naomi**: overwhelm comes from many categories, not 11 skincare products | To do | Content |
| **Next V4 batch from the missed clears** (glucosamine, BCAAs, the Hyrox cryo, collagen and others still on V3 or unread) | To do | Catalog work (Ishan or a session) |
| A harmful habit that's theirs: one gentle reconsider about 90 days later | Not built | Rules |
| Mixed-evidence cost habits can still be planned into the Ritual (Kenji's "Phone in bed") | Not built | Rules |
| With Claude off, a swap line can fit a social night better than a solo habit (Simone) | Known | Claude on |
| Reading their notes to answer a card ("I eat maybe half of them") | Needs Claude on | The learn step |
| The monthly budget question | Not built | Priority 3 |
| The 17 swaps' evidence | Tabled | Expert |
| 10 mg melatonin (above the studied doses) gets no word | Not built | A high-dose rule |

## 14. How we work

- **Branches and PRs only.** Never push to `main`: it deploys the site and the app. Claude sessions push branches and open PRs. Veer reviews and merges. Name changes in Ishan's or Rohan's area in the PR.
- **Before saying what the code does,** `git fetch` and read `origin/main`.
- **Checks before every PR:** `npx -y pnpm@10.34.6 check` (lint, types, about 1,960 tests, catalog, tone) and `build:web`. Never commit `apps/web/next-env.d.ts` or any `.env`.
- **When the engine changes, refresh the power report:** `pnpm sim:power`, then `pnpm sim:labels` (it takes a few minutes). CI's `catalog` job runs `pnpm sim:check` and fails with "Power report is stale" otherwise. The numbers don't move; only the source fingerprint does.
- **Stacked PRs:** the repo uses merge commits and doesn't delete branches on merge. A PR built on another PR's branch merges into that branch, not `main`. Either point each PR at `main` before merging, or merge the top one into `main` (as #45 did).
- **Commands:**

| Command | What it does | Cost |
| --- | --- | --- |
| `pnpm catalog:build` | Workbook → JSON, validated | Free |
| `pnpm eval:gates` | The hard gates on all 41 | Free, seconds |
| `pnpm eval:engine` | All 41, rules only, with a report | Free |
| `pnpm eval:engine --claude --judge --yes` | All 41 with Claude and the judge | About $15 |
| `pnpm eval:ab --yes` | The blind A/B | Spends |
| `pnpm ritual:show <id> [--claude]` | One person's Ritual, proposals, replies, and why anything fell back | Free; cents with Claude |
| `pnpm golden:review [out.json]` | The 41 for the review page | Free |
| `pnpm catalog:review` | The rows Distill can suggest dropping, in a member's words | Free |
| `pnpm engine:backfill [--write]` | Existing testers into the engine | Free |

- **Claude is off by default.** Nothing spends without a deliberate flag or setting. Veer approves spend.
- **Previews:**
  - landing page: `python3 -m http.server 3000 -d public`
  - app: `pnpm --filter @distill/web exec next dev`
  - The engine's signed-in screens need Supabase, so locally they show the signed-out app. Try them on a PR's Vercel preview.
- **Veer's style:**
  - recommendation first, concise, simple words; show, don't describe
  - phone-size checks for anything people see
  - when something breaks mid-task, fix it properly or ask one clear question

## 15. Known issues

- **Engine tables and sign-in emails in production are unconfirmed** (priority 2).
- **Claude has never run on a real person or the 41** (priority 1).
- **PRs #39–#44 are open but already merged** through #45: close them.
- **54 items the app knows are still V3 only** (unknown evidence, never cleared or protected); 93 V3 rows were never fact-checked.
- **No explore idea is certified,** so explore shows nothing.
- **Day-one Rituals cap each moment at three parts,** so supplements compete for places. Unknown frequencies are guessed as "once a week" unless their ideal day says otherwise.
- **The business model is open:** membership, or partners we'd recommend anyway, always labelled.
- **Old docs** (`SPEC.md`, `docs/DIRECTION.md`, `docs/Product-Context.md`, the phase docs) are history: their test-first framing and gallery-white look are superseded.

## 16. Start here: Ishan's Claude, Rohan's Claude

**Ishan's Claude (the engine, the catalog, evaluation):**
1. Read this file, `docs/ENGINE.md`, `docs/AI-BACKEND.md`, `eval/review/the-41-fixes.md`.
2. `npx -y pnpm@10.34.6 install --frozen-lockfile`, then `pnpm check` and `pnpm eval:engine`. All 41 should pass every gate, with about 49% of clears found.
3. Run Claude on the 41 (priority 1). Veer has approved about $15. Start with `pnpm ritual:show veer-00 --claude`.
4. Read the report's critiques, group them, fix the biggest group, re-run. Prompts are in `apps/web/lib/ai/engine/prompts.ts`; bump the step's `PROMPT_VERSIONS` entry when you change one.
5. Keep Veer's rules (section 8). If a fix seems to need breaking one, ask Veer first.
6. Then the next V4 batch from the missed clears, through the workbook: sources opened, re-checked, and the validator passing.

**Rohan's Claude (Supabase, the API, deploys):**
1. Read this file and `docs/ENGINE.md` ("Going live, in order").
2. Check the engine tables in Supabase project `hzwiikkttligpmkvondy` against `supabase/migrations/20261021000001_engine.sql`, and apply it if they're missing.
3. Sign-in email: custom SMTP, the redirect URL and the token_hash template (priority 2).
4. Sign up fresh on https://distill-app-nu.vercel.app, onboard, and confirm the first Ritual, a Today card and a companion reply.
5. `pnpm engine:backfill --write` for existing testers.
6. Leave `ENGINE_CLAUDE` off until Veer says otherwise.

## 17. Glossary

| Term | Meaning |
| --- | --- |
| **Ritual** | The whole system of someone's mornings, days, evenings, nights and weekends. Never one habit |
| **Part** | One thing in their Ritual (a `RitualPart`: when, title, why, source, lock) |
| **The base / a day** | Their usual week (`base` version), and one date's changes (`day` version). Reshapes change a day; their edits can change either |
| **Their list (stack)** | Everything they told us they take, do or pay for (`progress.items`) |
| **Clear / keep / curate / refer** | Let it go (or swap) / it stays / shape it (anchor, budget, dose) / a professional's call |
| **Theirs / loved** | "This is mine" (final, locked) / they love it. Theirs also comes from their words tying it to people, a tradition or their job (for habits that cost them) |
| **Borrowed** | It came from a feed, an ad, a podcast or someone else's routine |
| **Tier, cost direction** | The catalog's evidence grade, and whether it's evidence of a benefit or of a cost |
| **Question card** | One tap that can change a decision; always "Not sure" and "Or tell me in your words" |
| **Swap** | A thing to do in place of what they let go of, from the catalog, offered once |
| **Anchor (PAIR)** | Putting a well-founded daily thing next to something they already do every day |
| **The 41 / golden set** | The test people every change runs against, each with an answer key |
| **Hard gates** | The promises checked on every run (section 10). Any failure blocks a change |
| **The judge** | Opus scoring each person's Ritual and words with Claude on, calibrated with planted bad outputs |
