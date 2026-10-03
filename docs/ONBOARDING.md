# Onboarding and app screens (Phase 8)

Draft for the one checkpoint, 2 October 2026. This is the spec the `apps/web` build follows. It turns the Figma Make prototype (https://oval-dill-03025795.figma.site, nine screens, captured in [prototype-2026-10-02.jpg](prototype-2026-10-02.jpg)) into the screens SPEC section 11 asks for, on the landing page's design system.

Nothing here changes `packages/catalog`, `packages/engine`, or the Phase 2 branch. Routing, scheduling, statistics and verdict text are not merged, so the screens read from typed fixtures shaped like SPEC's `RoutedStack`, `DayOneSummary` and verdict output. When `routeStack` lands, the fixtures are replaced and the screens stay.

## 1. Decisions taken

| # | Decision | Choice |
| --- | --- | --- |
| 1 | Look | The landing page's system in its dark variant: ink ground, mint accent, glass panels, Sora and Geist Mono, Italiana wordmark. This is what the site's verdict explorer already uses. Colours live only in the token sheet (section 4), so the light variant is a one-file swap if the team prefers SPEC's literal off-white. |
| 2 | Free text | Typeahead over the 210 catalog items is the primary path. The free-text box stays as a scratchpad that highlights catalog matches as you type. No language model, no API key. |
| 3 | The reveal | Kept, as the first moment of the day-one screen: "21 things. $1,428 a month." Then the sentence SPEC gives for day one. The prototype's "Most of it chosen for someone else's life" goes; it is about the person. |
| 4 | Demo first | The whole flow runs on a `demo` data source that reproduces the Worked Example. Oura and WHOOP buttons call the Phase 2 routes and show a plain error state until that branch merges. |
| 5 | Tooling | Node 24 through nvm (user space, no admin password) and pnpm 10.34.6 through npm. Waiting for your yes before anything is installed. |

## 2. What changes from the prototype, and why

| Prototype screen | What happens to it | Reason |
| --- | --- | --- |
| 1 Splash: "Distillyour life." | Kept as Welcome, one line and one button. The second line ("Not who they imagined. Who you are.") goes. | The second line describes the person. The missing space is a rendering bug. |
| 2 "Talk us through what you do" | Folded into Your stack as the scratchpad. "Find my essentials" goes; nothing is behind it. | SPEC 11.2: fuzzy search over the catalog is the primary path. |
| 3 Inventory with origin chips | Becomes Your stack: catalog search, prefilled editable cost, chips doctor / blood test / friend / podcast / online / other. Categories come from the catalog. | SPEC 11.2. The prototype's TikTok / ad / can't remember chips do not map to the engine's `source` answers. |
| New: Connect | Oura, WHOOP, Fitbit, Apple Health export, use demo data, with backfill progress. Placed before the stack. | SPEC 11.1. |
| 4 "Tell us about the life you want" | Becomes What for: chips from the Goal to Number sheet, multi-select, "nothing specific" allowed. | The engine routes on a goal, not on prose. There is no model to read free text. |
| 5 Five fixed questions | Becomes Follow-ups: generated from each item's `followUpTrigger`, `question` and `answerOptionsText`, one per screen, chips plus one number box for dose. Exact value asked when a chip crosses a rule threshold. "Did a doctor put you on any of these" goes; the origin chips already answer it. "What would you never give up" goes; nothing in the engine reads it. | SPEC 11.3, OPEN_QUESTIONS THRESHOLD_CHIPS. |
| 6 Reveal | Kept, as the top of Day one. | Decision 3. |
| 7 "Here's what we heard" letter | Dropped. | It reflects text the app never read. Nothing in the catalog can template it. |
| 8 Four coloured groups, blurred reasons, "$114 a month back" | Becomes Day one: five groups in the tiers' own words, every sentence from the catalog, nothing blurred, overlaps shown as pairs you choose between. No red. | SPEC 11.4, Tone Guide, Emotional Positioning rule 2. The prototype's "Ready to let go" card is red. |
| 9 Membership, Pay, $20 | Dropped. Onboarding ends on Day one with the first experiment and what the daily tap looks like. | SPEC section 10 and 11: no price, trial or guarantee copy in the app. `PRICING_ENABLED=false`. |
| Never reached | Today, Verdict, Your file, Settings are added. | SPEC 11.5 to 11.8. |

Everywhere: sign-in by Supabase magic link, progress saved after every answer, back keeps answers, loading, empty and error states on each screen, a progress line that counts the real steps, the disclaimer in every footer, text contrast at 4.5:1 or better, 44px targets, full keyboard operation, a reduced-motion path, and every string the app renders checked by `toneLint` in tests.

What the prototype got right and the build keeps: one question per screen, the inventory grouped with editable costs, the origin question (doctor or blood test means Protected; the rest is narrative), the reveal, the four-way sort, the calm.

## 3. Screens in order

| Step | Route | Screen | Progress shown |
| --- | --- | --- | --- |
| – | `/` | Welcome | none |
| – | `/sign-in`, `/auth/callback` | Sign in by email link | none |
| 1 | `/connect` | Connect | 1 of 5 |
| 2 | `/stack` | Your stack | 2 of 5 |
| 3 | `/goals` | What for | 3 of 5 |
| 4 | `/questions` | Follow-ups | 4 of 5, then "Question k of N" inside the step |
| 5 | `/day-one` | Day one, ending on the first experiment | 5 of 5 |
| – | `/today` | Today | app tabs: Today · File · Settings |
| – | `/verdicts`, `/verdicts/[id]` | Verdicts and the verdict card | app tabs |
| – | `/file` | Your file | app tabs |
| – | `/settings` | Settings | app tabs |

Five onboarding steps, so the progress line has five segments. The follow-ups step shows its own count ("Question 3 of 9") because the number depends on the stack. Back always keeps answers. Reloading any screen returns to it with everything intact.

Target time from Connect to Day one on the demo stack: under four minutes. The follow-ups step asks the 21-item Worked Example twelve questions (eight items; the meditation app and the facials each take a yes, a chip and, for the app, an exact day count; training after 7pm is a one-tap confirmation of what the workouts say). Magnesium's goal is never asked because at 120 mg the rule settles on "dose too low" first.

## 4. Token sheet

A dark variant of `public/index.html`'s `:root`. The values the site's verdict explorer (`.vx`) already uses are the starting point. Every colour below was checked against WCAG 2 contrast on the ink ground.

```css
:root {
  --bg: #15211F;                       /* the site's --ink, now the ground */
  --surface: #1C2B29;                  /* raised panels */
  --glass: rgba(243,246,245,.06);      /* the one surface treatment, product objects only */
  --glass-edge: rgba(243,246,245,.12);
  --ink: #F3F6F5;                      /* text; the site's --pale.  15.2:1 on --bg */
  --mint: #9FD0C9;                     /* the only accent.          9.7:1 on --bg */
  --muted: #BEC3C2;                    /* secondary text.           9.3:1 on --bg, 7.9:1 on glass */
  --faint: #79817F;                    /* strokes and dots only, never text (4.1:1) */
  --rule: rgba(243,246,245,.14);
  --rule-2: rgba(243,246,245,.30);
  --sans: "Sora", "Helvetica Neue", Arial, sans-serif;
  --mono: "Geist Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --wordmark: "Italiana", "Bodoni Moda", Georgia, serif;
  --ease-out: cubic-bezier(.23,1,.32,1);
  --ease-in-out: cubic-bezier(.77,0,.175,1);
  --r-card: 24px; --r-ctl: 12px; --r-pill: 999px;
  --gutter: clamp(20px,4vw,48px);
}
```

What the prototype gets wrong, for the record: its small text is `rgba(255,255,255,.38)` on near-black (3.6:1), its labels run 8 to 11px, and the "Ready to let go" card is `#6B1F1A`.

Type. Sora 300 for display numbers and headings at 28px and up, Sora 400 for everything else (350 reads thin on a dark ground), Geist Mono for numbers, labels and units. Body 17px, line height 1.6, measure 60ch. Minimum text size 14px; 16px in any input so phones do not zoom. Headings balanced, tracking never tighter than −0.03em. Wordmark DISTILL in Italiana with 0.2em tracking, as on the site. Fonts load through `next/font/google` so they are self-hosted at build and never fetched at runtime.

Colour. Mint is the only accent and it means "interactive or current": filled buttons (mint on ink text, 9.7:1), the progress line, focus rings, the current day. Tiers and verdict words are never coloured. Kept, Dropped, Inconclusive, Protected are words in the same type, told apart by the site's line icons (`i-flask` tested on you, `i-checkc` no test needed, `i-eyeoff` can't measure it, `i-shield` protected). Nothing is ever red, and the token sheet has no red.

Surfaces. Glass (`--glass` with a 1px `--glass-edge` and the site's top highlight line) for product objects only: the stack list, the day-one cards, the Today card, the verdict card. Everything else sits flat on the ground. No cards inside cards.

Controls. Buttons are pills, 52px high (44px for small), verb plus object. Chips are pills, 44px high, `aria-pressed`, mint when selected. Inputs 16px, 52px high, `--r-ctl` corners, mint focus ring at 3px. Every target 44px or more. Focus is always visible (`:focus-visible` 2px mint, 3px offset).

Motion. Only `transform`, `opacity` and `clip-path`. Entering: 200 to 300ms `--ease-out`. Press: scale 0.97 for 160ms. Content swap: 2px blur for 200ms. Stagger 40ms. One authored moment per flow: the day-one count-up (600ms). `prefers-reduced-motion: reduce` and the Settings switch "Less motion" turn every transform off, keep fades at 150ms or drop them, and render count-ups as their final value. Nothing moves on its own except the backfill progress bar.

Layout. One centred column, max 560px, for onboarding and Today. Your file and Settings may go to two columns above 960px. At 390px: 16px side gutter, no sideways scroll, buttons full width. At 1440px: the column stays 560px with the ground around it. The phone frame of the prototype is not reproduced; the app is the page.

Icons. The 20-symbol sprite from the top of `public/index.html` is copied into `apps/web/components/icon.tsx` unchanged.

## 5. Each screen

Reads and writes: "catalog" means `@distill/catalog` through `data/catalog.json`; "fixture" means the demo data source in `apps/web/lib/data/demo`; "progress" means the saved onboarding state (Supabase when configured, this device otherwise, section 6). Copy below is final. Headings are sentence case. No exclamation marks anywhere.

### Welcome `/`

- Wordmark DISTILL.
- H1: **Distill your life.**
- Line: Everything you take, buy and do for sleep and recovery, read against your own nights.
- Button: **Begin**. Link: **I already have an account**.
- Without Supabase configured, Begin goes to Connect and the account link is hidden.
- Reads nothing. Writes nothing.

### Sign in `/sign-in` and `/auth/callback`

- H1: **Where can we send your link?**
- Line: No password. We email you a link that signs you in.
- Field: Email. Button: **Send my link**.
- Sent state. H1: **Check your email.** Line: The link is good for an hour. Open it on this device to carry on. Buttons: **Send it again**, link **Use a different address**.
- Errors: *We couldn't send the link. Check the address and try again.* Rate limit: *That's a lot of links in a short time. Give it a few minutes.*
- Callback: a 150ms fade with the line *Signing you in*, then the saved step. Failure: **That link has expired or was already used.** Button **Send a new link**.
- Reads nothing. Writes a Supabase session cookie through `@supabase/ssr`; creates the `app_profiles` row.

### 1 Connect `/connect`

- H1: **Where do your nights come from?**
- Line: Distill reads sleep and recovery from the wearable you already own. Nothing to log by hand.
- Options, each a 52px button with the `i-watch` icon: **Oura**, **WHOOP**, **Fitbit**, **Apple Health export**, **Use demo data**.
- Under demo: A made-up person with six months of nights and a 21-item stack. Nothing here is yours yet.
- Apple Health: a file field **Upload export.zip** and a link **How to export from the Health app** (Apple's own page).
- Backfill. H2: **Reading your history.** Line: *183 nights so far* with a progress bar. Done: *Six months of nights, ready.* Button **Continue**. On demo the bar runs about two seconds; with reduced motion it fills at once.
- Loading: skeleton pills in the exact size of the five options.
- Error on a live provider: *We couldn't start that connection. Try again, or use demo data for now.* Buttons **Try again**, **Use demo data**.
- Flag `NEXT_PUBLIC_PROVIDERS_ENABLED=false` (default until Phase 2 merges) renders the four live options disabled with the line *Not yet connected in this build.*
- Reads `GET /api/providers` for status after a live connect (Phase 2). Writes `app_profiles.data_source`, `onboarding_step`.

### 2 Your stack `/stack`

- H1: **What's in your stack?**
- Line: Everything you take, buy or do for sleep, recovery and how you look. Search below, or write it out and we'll match what we can.
- Search field, label **Search 210 things**, placeholder *Try magnesium, Equinox, cold plunge*. Results list under the field: name, category, typical cost in mono. Arrow keys move, Enter adds, Escape closes. The matcher scores name, the parenthetical alternatives in the name ("Greens powder (AG1 etc.)" answers to "ag1"), slash-separated terms, and a short hand-written alias list kept next to it, with prefix, subsequence and edit-distance-2 matches, in that order.
- Scratchpad: a disclosure **Or write it out**. Textarea placeholder *I go to Equinox, take AG1 most mornings, do Pilates twice a week.* As you type, matched catalog names appear as chips under the box, each reading **Add Greens powder (AG1 etc.)**. Unmatched phrases stay in the notes and nothing is guessed.
- Not listed: button **Add something not listed** opens a name and cost pair. Line under it: *We'll count the cost. Reading it comes later.* Custom items are saved with no catalog key.
- The list, grouped by catalog category with these headings: **Supplements**, **Food and drink**, **Timing**, **Habits**, **Devices**, **Services**, **Environment**, **Skincare**, **Not listed**.
- Each item (a glass row): name; cost field, label **a month**, prefilled from `monthlyCost`, editable, mono; the origin chips under the label **Where did it come from?**: doctor · blood test · friend · podcast · online · other; a **Remove** button (`i-minusc`, 44px, labelled for screen readers). Doctor or blood test marks the row *Protected* at once, in words, with the shield icon.
- Running total above the button in mono: *21 things · $1,428 a month*.
- Button: **That's everything**. If the list is empty the button stays and the line *Add at least one thing to go on.* appears when it is pressed.
- Demo: prefilled with the Worked Example's 21 items and origins. Line at the top: *Prefilled from the demo person. Change anything.*
- Loading: skeleton rows. Empty: the search field and the scratchpad, nothing else.
- Reads catalog (a slim client index: key, name, category, cost, aliases, about 20 KB) and progress. Writes `stack_items` on every change (debounced 400ms) and `onboarding_step`.

### 3 What for `/goals`

- H1: **What are you hoping to change?**
- Line: Pick as many as fit. "Nothing specific" is a real answer.
- Chips from the Goal to Number sheet, stored under the sheet's names, shown as: Sleep · Falling asleep · Staying asleep · Deep sleep · Recovery and stress · Energy · Fitness · Focus and memory · Mood · Skin and hair · Gut · Joints and soreness · Weight · Immunity · General health · Hormones · Nothing specific.
- Button: **Continue**.
- Reads catalog `goals`. Writes `app_profiles.goals`.
- Per-item goal is asked in Follow-ups only where the item's rule reads `goal` (magnesium does). How the overall goal feeds routing step 3 is logged as GOAL_PER_ITEM.

### 4 Follow-ups `/questions`

One question per screen. The list is generated from the saved stack: every item whose `followUpTrigger` is not `NONE` or `OVERLAP` gets its catalog `question` as the H1 and its `answerOptionsText` parsed into chips and, for `DOSE_FORM`, a number box with the unit from the text. Items the wearable can read (training after 7pm: "read from workouts") become a confirmation instead of a question.

- Eyebrow: the item name. Count: *Question 3 of 9*.
- H1: the catalog wording, for example **Which form, and how much a day?**
- Line, where the sheet gives one: *The label on the bottle answers both.*
- Chips from the sheet, plus **Not sure** where the sheet lists it. Number box with the unit prefilled (*mg elemental*, *mg EPA+DHA*, *g*, *ml*, *IU*). For omega-3 the sheet asks per capsule and capsules a day, so two number boxes and the daily total shown in mono.
- Button: **Continue**. Back keeps the answer.
- Threshold follow-up (OPEN_QUESTIONS THRESHOLD_CHIPS). After the chips, the item's rule is evaluated with `evaluateItemRule`; if it returns `needsAnswers` naming an exact field (`daysSinceLastUse`, `visitsLast30Days`, `visitsPrevious30Days`, `cupsPerDay`, `dinnerToBedMinutes`), a second screen asks for it. H1: **About how many days ago?** or **How many visits, exactly?** Line: *The chip you picked sits on the line this one is read on, so the exact number matters.* Never a midpoint. This uses the engine's own "unanswered fields" signal, not a copy of its thresholds.
- Confirmation from data. Eyebrow: Training after 7pm. H1: **We read this from your workouts.** Line: *Four evening sessions a week, ending around 9pm.* Chips: **That's right** · **Change it**. On the demo this comes from the fixture; live, from Phase 2 workouts.
- Loading between items: 2px blur swap. Done: the line *Reading your stack* over a skeleton of the day-one card, then Day one.
- Reads catalog items and `followUpQuestions`, engine `evaluateItemRule` for `needsAnswers` only. Writes `stack_items.answers` per item, `onboarding_step`.

### 5 Day one `/day-one`

The reveal first, then the groups, then the first experiment. All on one page so nothing is hidden behind a tap; the groups fade in under the count (or are simply there, with reduced motion).

- Reveal. Display line one: **21 things.** Display line two: **$1,428 a month.** Both count up over 600ms. Then the SPEC line in body type: *10 come off today, $767 a month back. 4 lined up for testing. 2 we can't measure, cost shown. 4 to keep. 1 left alone.* Button **Show me** scrolls to the groups (keyboard: it is a link to `#groups`).
- Group headings, in the tiers' words from Start Here:
  - **No test needed** · The answer is already known. The money comes back today.
  - **Tested on you** · A wearable can see these. Three days on, three off, one number, one word.
  - **Can't measure it** · We can't see these in your data and we won't pretend to. The cost is shown; the call is yours.
  - **Keep** · Worth keeping, on the evidence or on how you use it.
  - **Protected** · We leave these alone.
- Each item is a glass card: icon for the group, name, the reason in plain words for drops (**Dose too low**, **Form not absorbed**, **Tested, found nothing**, **No way it could work**, **Overlaps with something else**, **Not being used**), the catalog `dayOne` sentence word for word, the monthly cost in mono (annual for Can't measure it), the catalog `safety` line in a plain box when present, and *Being checked* in mono when `unverified` and `NEXT_PUBLIC_SHOW_UNVERIFIED=true`. Protected cards carry the Protected template sentence and no cost.
- Drops: a two-way switch **Let it go** (default) · **Keep it anyway**. The totals in the reveal line update.
- Overlaps: both items side by side in one card. H3: **These two do the same job.** Each with visits or last used and cost. Chips: **Keep Equinox** · **Keep Barry's**. The engine's suggestion is preselected and labelled *Suggested, on visits: 11 against 2*. The person can swap. Nothing is dropped without the choice being visible.
- Too small to see: a switch **Run it anyway**, with the catalog's gated sentence. (The Worked Example has none; the state is unit-tested.)
- Tested on you: each card adds *We'd watch: total sleep* and *Chance of a clear answer: good* from the catalog, and a day-one hypothesis sentence where the fixture has one (training after 7pm).
- End card. H2: **Your first experiment.** Name: **Coffee after 2pm.** Lines: *Fourteen days from Monday. Three days on, three days off.* *Each morning: one line, one tap. A missed tap counts as unknown, never as a miss.* Number box: **Roughly how many months has this been part of your days?** with **Not sure**. Buttons: **Start the first experiment**, secondary **Not this one** (opens the list of the other lined-up items; one veto per cycle, per SPEC 7).
- Loading: skeleton of the reveal and three cards. Empty (no items routed): H2 **Nothing to read yet.** Button **Back to your stack**. Error: *We couldn't read your stack. Nothing was lost.* Button **Try again**.
- Reads the fixture `RoutedStack` for the demo source, and `DayOneSummary` computed arithmetically from it plus the person's switches. Writes `stack_items.status` (cut, kept, testing, protected), the overlap choice, run-anyway flags, the months answer, `onboarding_step = done`.

### Today `/today`

- Eyebrow in mono: *Day 5 of 14 · an off day*.
- Line: **Today: no coffee after 2pm.** (on days: **Today: coffee as usual.**)
- Buttons: **Did it** · **Didn't**. After a tap: *Noted. The test carries on.* Both answers are recorded in the same tone. No tap by midnight is stored as unknown.
- Link: **Don't count last night** opens a sheet. H2: **Leave last night out?** Chips: Ill · Travelling · Kids woke me · Unusually hard session · Something else. Button **Leave it out**, link **Keep it in**.
- The 14-day strip from the site (`.days`), filled for past days, the current day outlined, unknown days marked *unknown* in mono.
- Under it: *The number we watch: total sleep. Written down on day one; it doesn't move.*
- Observe-only item (drinks): off nights are assigned (**Tonight: no drinks.**); on nights are never assigned. The morning after an on night shows the "Tier 1, observe-only (morning after)" template with the fixture numbers, nothing else, no colour.
- Day 14 done: H2 **Your verdict is ready.** Button **Read the verdict**.
- Empty: H2 **Nothing to tap today.** Line: *Your first experiment starts Monday.* Button **See day one**.
- Error saving a tap: *We couldn't save that. Tap again.*
- Reads the fixture experiment (schedule, instruction lines, metric) and `daily_taps`. Writes `daily_taps`.

### Verdict card `/verdicts/[id]` and the list `/verdicts`

- Eyebrow: *Verdict · Coffee after 2pm*.
- Effort first, in body type: *Fourteen days, thirteen taps.*
- Display number: **−47 min** with the mono line *total sleep on coffee days*.
- Definition list: *Your normal swing* 40 min · *Nights counted* 13 of 14.
- The word, in the same type as everything else: **Dropped**.
- The template text, filled from the fixture: *Coffee after 2pm: your total sleep was 47 minutes shorter on the days you did it, outside your normal swing of 40. 8 months in. Dropped.* (The cost clause is omitted at $0, as the template's own example does. Logged as ZERO_COST_DROPPED.)
- The 14 nights, as on the site's explorer: dots, two averages, hover or tap a night to read it, a mono scale.
- Buttons: Dropped → **Let it go** · **Keep it anyway**. Kept → **Keep it**. Inconclusive → **Keep it** · **Let it go**. Every verdict ends with the decision in your hands.
- Line after the choice: *Next: drinks in the evening. Off nights only; we never assign a drink.* Button **Line up the next one**.
- The list: one row per verdict, name, word, number, date. Empty: *No verdicts yet. The first lands on day 14.*
- Reads the fixture verdict (template name, filled text, numbers, nights) and `daily_taps` for the effort line. Writes `stack_items.status`.

### Your file `/file`

- H1: **Your file**
- Scoreboard, mono: **10 things** *was 21* · **$661 a month** *was $1,428*. The numbers only go down.
- H2: **What you cut** · each row: name, the reason or the verdict word, cost a month, the date.
- H2: **What's yours** · Kept verdicts with their number, and the day-one keeps tagged *kept on day one*. Empty: *Nothing proven on your data yet. Your first verdict lands on day 14.*
- Reads `stack_items`, the fixture verdicts. Writes nothing.

### Settings `/settings`

- H1: **Settings**
- H2: **Connected sources** · rows with the source name and *since 2 October*; button **Disconnect**; button **Add a source**.
- H2: **Your data** · button **Export my data** (downloads a JSON file of everything the app holds on you); button **Delete everything**. Dialog H2: **Delete everything?** Line: *Your account, your stack, your taps and every night we pulled. Gone, not archived.* Buttons **Delete everything** · **Keep my account**. Done: *Everything is deleted.* then Welcome.
- H2: **Display** · switch **Less motion**.
- H2: **Account** · the email, button **Sign out**. Without Supabase: *Saved on this device only.*
- Reads `app_profiles`, `GET /api/providers`. Writes `app_profiles.reduced_motion`; delete calls Phase 2's `DELETE /api/account` when present, else the Phase 8 server action that removes the Phase 8 rows and the auth user.

### Every screen

- Footer: wordmark, then the disclaimer: *Distill is a wellness tool for self-reported goals and self-owned data. It is not a medical product and nothing here is medical advice. If a clinician prescribed or recommended something, keep taking it and talk to them before changing it.* (The site's version says "diagnose, treat or prevent", which `toneLint` rejects; logged as DISCLAIMER_WORDING.)
- Back in the onboarding bar returns one step with answers intact. The browser back button does the same.
- Loading states are skeletons the exact size of the content. Errors are one sentence and a button. Nothing is ever red.

## 6. Data

### Fixtures, shaped like SPEC

`apps/web/lib/data/types.ts` holds the types the screens render. They mirror SPEC sections 6 to 10 and the engine's `EvaluatedRule`, so Phase 3 to 7 output drops in.

- `RoutedItem`: stack item plus a `Landing` (tier, reason, canRunAnyway, keep, expectedEffect, metric, chance, dailyRating, overlapGroup, the catalog `dayOne` sentence, `safety`, `unverified`, optional history hypothesis).
- `RoutedStack`: items, overlap pairs with the engine's suggested drop, the ordered experiment queue.
- `DayOneSummary`: count, monthly total, drops today, monthly back, lined up, can't measure, keep, protected. Computed arithmetically from the landings and the person's switches; never from rules.
- `Experiment`: item, status, start date, the on/off schedule, metric, direction, swing, the immutable pre-registration record, the two instruction lines.
- `Verdict`: word, template name, filled text, the number with unit and swing, 14 nights, effort (days, taps), cost.

### The demo data source

`apps/web/lib/data/demo/` reproduces the Worked Example sheet row by row: 21 items, the tapped answers, 10 drops, $767 a month back, 4 lined up, 2 can't measure, 4 keep, 1 Protected (the Oura ring, as a data-source line with no catalog row; logged as WEARABLE_SUBSCRIPTION_ROW). The demo person is on day 14 of the first experiment (coffee after 2pm, the sheet's first): thirteen mornings are already tapped, one of them missed and left as unknown, and the fourteenth is the tap on screen. That tap completes the fortnight and the verdict (Dropped, 51 minutes against a swing of 40, from the "Tier 1, dropped" template) is ready to read, so the click-through reaches a completed verdict. Today says so in one line: the fortnight is already behind you because this is demo data. The second experiment (drinks in the evening, off nights only) is named as next. The headline total is the arithmetic sum of the entered costs, $1,428; the sheet's prose says $1,342, which is $1,428 less the drinks ($80) and the Oura ring ($6). Recorded under WORKED_TOTAL.

Items you add in demo mode that are not in the fixture are listed under **Not read yet** on Day one with their cost, counted in the total and nowhere else.

Every string in the fixture (instruction lines, filled verdicts) passes `toneLint` in a test. The catalog `dayOne` sentences are the sheet's; two demo rows fail the lint today (magnesium at 61 words, meditation app in the third person) and are listed, not rewritten.

### The data-source interface

```ts
interface DataSource {
  id: 'demo' | 'supabase';
  loadProgress(): Promise<Progress>;
  saveProgress(patch: Partial<Progress>): Promise<void>;
  routedStack(stack: StackItem[], answers: Answers): Promise<RoutedStack>;  // demo: fixture. supabase: Phase 3
  experiments(): Promise<Experiment[]>;
  verdicts(): Promise<Verdict[]>;
  tap(experimentId: string, night: string, value: 'did' | 'didnt' | 'unknown', excluded?: string): Promise<void>;
}
```

`Progress` is the onboarding state: step, data source, goals, stack items with costs, origins and answers, day-one choices. It is saved after every change, to Supabase when `NEXT_PUBLIC_SUPABASE_URL` is set and to `localStorage` otherwise, so a stranger with no keys can run `pnpm dev`, pick demo data and click through.

### Supabase

Sign-in: `@supabase/ssr` with a cookie session, `/auth/callback` exchanging `token_hash`, and middleware that refreshes the session. The email template points at `/auth/callback`; Phase 2's `/api/auth/confirm` returns a JSON session for API clients, and one project has one template, so this is logged as EMAIL_TEMPLATE_PATH.

Tables, in `supabase/migrations/202610030001_phase_eight.sql`, all owner-only through row-level security on `auth.uid()` and written through server actions:

| Table | Columns | Written by |
| --- | --- | --- |
| `app_profiles` | user_id (pk, cascades from `auth.users`), data_source, onboarding_step, goals text[], reduced_motion, created_at, updated_at | Sign in, Connect, What for, Day one, Settings |
| `stack_items` | id, user_id, item_key (null for custom), custom_name, monthly_cost, origin, answers jsonb, status (listed · cut · kept · testing · protected), status_changed_at, position, created_at | Your stack, Follow-ups, Day one, Verdict |
| `daily_taps` | user_id, experiment_id, night, value (did · didnt · unknown), excluded_reason, created_at; primary key (user_id, experiment_id, night) | Today |

Experiments, pre-registration records and verdicts are not stored by Phase 8; they belong to Phases 4 to 7 and come from the fixture until then. Delete everything cascades from `auth.users` so it composes with Phase 2's deletion.

Environment: `apps/web/env.example` carries Phase 2's keys plus `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_PROVIDERS_ENABLED=false`, `NEXT_PUBLIC_SHOW_UNVERIFIED=false`, `PRICING_ENABLED=false`. `apps/web/billing/index.ts` exists, exports the flag, and holds one TODO.

### Fitting beside Phase 2

Phase 2 (`origin/phase-2/data-sources`) also creates `apps/web` (`package.json`, `next.config.ts`, `tsconfig.json`, `app/api/[...path]/route.ts`, `src/server/*`) and edits the root `package.json`, `eslint.config.js` and `.gitignore`. Phase 8 starts those files from Phase 2's versions and only adds to them (`@distill/catalog`, `@distill/engine`, `@supabase/ssr`, `devIndicators`, the lint and typecheck globs, Next 16's `allowJs` and `.next/dev/types` entries in `tsconfig.json`). Two lines differ on purpose: `apps/web/package.json` depends on `@distill/catalog` and `@distill/engine` where Phase 2 depends on `@distill/providers` and `@distill/data`, and `next.config.ts` transpiles the former. At merge both lists are kept. `pnpm-lock.yaml` is regenerated with `pnpm install`. `src/server` and `app/api` are not touched. Logged as MERGE_WITH_PHASE_2.

The app runs on Next's webpack bundler (`next dev --webpack`, `next build --webpack`) because Turbopack cannot resolve the engine's and catalog's `.js`-extension imports to their `.ts` sources; `experimental.extensionAlias` maps them. Logged as ENGINE_IMPORT_EXTENSIONS, with the alternative.

## 7. Tone

- `apps/web/lib/copy.ts` is the only place a user-facing string lives. A test runs `toneLint` from `@distill/engine` over every string there, over every fixture string, and over the filled demo verdict, with the catalog's `toneRules`. No exceptions list.
- Second person. Under 60 words. No exclamation marks. Effort before the number on every verdict card. A missed tap is unknown. Money is a figure and the word "back". Protected gets one sentence and no cost. Tier 3 is never called a drop.
- The catalog's own sentences are rendered word for word; the rows that fail the lint are listed in a test's output and in OPEN_QUESTIONS, not edited.

## 8. Verification

Done in the built-in browser against `pnpm dev`, on the demo source, before each PR:

1. Every screen at 390px and at 1440px, screenshots in the PR.
2. Keyboard only: Tab order follows reading order, chips take Space and Enter, the typeahead takes arrows and Escape, dialogs trap focus and close on Escape, nothing needs a pointer.
3. Reduced motion: the Settings switch on and the browser preference on; no transforms run, count-ups are static, the backfill bar fills at once.
4. The full click-through: Welcome → Connect (demo) → Your stack → What for → nine follow-ups → Day one (10 drops, $767 back, 4 lined up) → Start the first experiment → Today → verdict card (Dropped) → Your file (10 things, $661) → Settings → Export → Delete everything.
5. Contrast of every text token on every surface it sits on, computed, not eyeballed. `pnpm check` green.

## 9. Pull requests

All on `phase-8/web-ui`, each a commit with tests and docs, none merged to `main` until you say so. All four are built; the verification sheets are in `docs/screens/`.

1. Scaffold: `apps/web` on Next.js App Router beside Phase 2's layout, tokens, fonts, icons, the components, Welcome, Sign in, Connect on demo, the progress store, the data-source interface, `pnpm check` extended to the app.
2. Your stack, What for, Follow-ups: the search index and matcher, question generation from the catalog with tests over all 210 rows, threshold follow-ups.
3. Day one: the fixtures, the demo scenario, the summary arithmetic, overlaps, switches.
4. Today, Verdict, Your file, Settings: taps, the verdict card and chart, export, delete, less motion.

## 10. Open questions logged for the team

Added to `docs/OPEN_QUESTIONS.md` under "Phase 8": GUARANTEE_COPY, EMAIL_TEMPLATE_PATH, WEARABLE_SUBSCRIPTION_ROW, ALIASES, DAY_ONE_SAMPLE_NUMBERS, ZERO_COST_DROPPED, EFFORT_MONTHS, INSTRUCTION_LINES, GOAL_PER_ITEM, DISCLAIMER_WORDING, WORKED_TOTAL (arithmetic note), CHIP_TO_RULE_MAPPING, DELETE_PATH, MERGE_WITH_PHASE_2.

## 11. The one line for the landing page

Not applied. The app is live at https://distill-app-nu.vercel.app (Vercel project `distill-app`, root directory `apps/web`, redeployed on every push to `main`). If the site needs a way in, add to the footer `<nav>` in `public/index.html`, after the Questions link:

```html
<a href="https://distill-app-nu.vercel.app/">Open the app</a>
```
