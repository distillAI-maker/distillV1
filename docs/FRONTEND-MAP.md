# Frontend map: the approved prototype, wired to the engine

28 October 2026. The Figma Make prototype (https://quota-find-46367323.figma.site, code export "Build Distill Ritual App") mapped screen by screen onto the real app in `apps/web` and the engine calls it uses. The last section lists what the backend doesn't support yet, for Rohan.

**How the app talks to the engine.** Every call goes through `engineApi` in `apps/web/lib/engine/client.ts` to `/api/app/engine/*` (`apps/web/src/server/engine-routes.ts`). Signed in only. Each call returns the whole `EngineState`, so a screen redraws from the answer. Signed out, there is no engine: the screens show the rules-only preview (`lib/engine/preview.ts`), and nothing is stored.

| Call | Route | Used for |
| --- | --- | --- |
| `engineApi.open()` | `night-check` | Opening the app: last night's check, then the state |
| `engineApi.run({ kind: 'part' })` | `run` | Ticking a part off |
| `engineApi.run({ kind: 'decision-answer' })` | `run` | Let it go / Not now / This is mine |
| `engineApi.run({ kind: 'question-answer' })` | `run` | A question card's answer |
| `engineApi.run({ kind: 'note' })` | `run` | A note on one thing (Distill learns from it) |
| `engineApi.run({ kind: 'stack-change' })` | `run` | Their list changed (a let-go, a new thing) |
| `engineApi.run({ kind: 'onboarding' })` | `run` | Their first Ritual, once they're signed in |
| `engineApi.message(text, about?)` | `message` | "What's coming up?", Why?, a note's reply |
| `engineApi.accept(versionId)` | `accept` | Make it mine; Make this my week |
| `engineApi.undo(versionId)` | `undo` | Undo; Not now on a proposed week |
| `engineApi.settings(on)` | `settings` | Let my nights shape my mornings |
| `engineApi.explore(want)` / `exploreAnswer` | `explore`, `explore-answer` | Explore, once ideas are certified |
| `engineApi.swapAnswer(itemKey)` | `swap-answer` | The swap offered after a let-go |

---

## Onboarding (PR 1: look only, same logic and words)

Every screen opens scrolled to the top. Back always goes to the previous step.

| Screen | Prototype | Real app file | What it does | Engine |
| --- | --- | --- | --- | --- |
| Opener | Still, no noise animation (Veer, 28 Oct): "There's so much noise." · Begin · I already have an account | `components/onboarding/arrival.tsx` | Begin goes to the name; someone returning picks up where they left off | None |
| Sign in | "Where can we send your link?" | `app/sign-in/` | Magic link | Supabase |
| Name (not numbered) | "First, what do we call you?" | `(onboarding)/name/` | Saves their name | None |
| 01 Tap everything you do | Six groups of bubbles · Rather talk it through? · Try it with an example stack | `(onboarding)/stack/` (tap) | Adds to their list | None |
| 01 Talk it through | Text box, "We recognise 3 things so far." | `(onboarding)/stack/` (listen) | Matches what they wrote | None |
| 02 Your current stack | Search, rows with a cost, Add something not listed | `(onboarding)/stack/` (edit) | Edits their list | None |
| 03 The number | Names gather into the spark, "3 things." "$236 a month." | `(onboarding)/number/` | Count and monthly cost | Routing (`/api/try` rules) |
| 04 Private study, 7 screens | Feed, never give up, normal day, reach for, busy, more time with | `(study)/study/` | Saves origin, theirs, asks | None (read later by the engine) |
| 04 Here's what we heard | The dark screen with the persimmon accent | `(study)/study/` (screen 7) | Their answers read back | None |
| 05 Your Ritual (reveal) | Shaping it around you → Mornings, Nights, Weekends · Always yours · Letting go · **Make it mine** · Change something | `(study)/reveal/` | Their first Ritual; Make it mine is their yes | `revealRitual` (rules preview); Claude's version via `shapeRitual` when on |
| 06 Join the Founding 100 | Member card, What you get, email | `(onboarding)/invitation/` | Waitlist + sign-in link | Supabase |
| Last · Your nights | Oura, WHOOP, Import, No wearable? | `(onboarding)/connect/` | Wearable or skip; last button "Open your Ritual" | Providers |
| Move-in | "Your Ritual" token travels with them and settles into the Ritual tab | across reveal → connect | Lands on the Ritual tab | None |

**Make it mine, signed in.** The reveal is drawn from rules on the phone. Once they're signed in, the engine composes their first Ritual (`onboarding`) and it waits as `proposed`. Since Make it mine was already their yes, the app accepts that proposed version on its own (`accept`) instead of asking again. With Claude on, the engine's version can read slightly differently from the one they saw (it reads their notes too).

---

## The app (PR 2): four tabs

Ritual (the default), Your things, Explore, Settings. The chat tab (`/companion`) and the Standard tab (`/home`) leave the navigation; their pages stay in the code until Veer says to delete them. The old test-first screens (verdicts, readings, experiments) leave the navigation too.

### Ritual

| Element | What they see | Data | Engine call |
| --- | --- | --- | --- |
| Header | "Friday, 30 October", "Good morning, Maya." | Browser clock, `state.person.name` | — |
| First-day line | "Your first day. Tick things off as they happen, and tell me what's coming up." | No checks yet in the week | — |
| This week | Seven day columns, dots for each part, people dots, a changed day outlined | `state.ritual.week` (base week plus day edits) | — |
| Day picker | Today, and any changed day | `state.ritual.week[].changed` | — |
| Today's timeline | Time, name, why, round check; locked parts show "Yours. Distill never moves it." | `state.ritual.today.parts` | — |
| Check-off | Tap the circle; the part fades | — | `run({ kind: 'part', done: true })` |
| One card a day | A let-go with the money back: Let it go · Why? · Not now · This is mine | `state.today.decision` | `run({ kind: 'decision-answer' })` |
| Question card | "Anything by your bed…?" style, answer bubbles | `state.today.question` | `run({ kind: 'question-answer' })` |
| Why? | Opens a sheet with Distill's answer about that thing | — | `message("Why let AG1 go?", stackItemId)` |
| Swap | After a let-go: "A swap, if you'd like it" | `state.today.swap` | `swapAnswer` |
| Answered | "That's all for today." | `decision.status !== 'proposed'` | — |
| What's coming up? | A pill; opens a sheet with suggestions and a text box | — | `message(text)` |
| The reply | Their words small ("You: …"), Distill's reply at the top | `result.reply` | — |
| Changed in place | The day switches to the changed one; changed parts get a spark line and Later / Lighter / Added, "was 7:30" | `state.ritual.lastChange`, `week[].changed` | — (see gap 3) |
| Undo | "Saturday, adjusted · Undo" | `lastChange.undoable` | `undo(versionId)` |
| A lasting change | Proposed week, "Make this my week" · Not now | `state.ritual.proposed` (with a parent) | `accept` / `undo` |
| Short night | "Short night, so this morning starts slow" · Undo | A `night` change in `lastChange` | `open()` runs the check; `undo` |
| Signed out | The rules preview of their Ritual and a sign-in card | `previewRitual` | — |

### Your things

| Element | What they see | Data | Engine call |
| --- | --- | --- | --- |
| What Distill knows | Chips: people, places, what they love; tap to correct | Their study answers and list (see gap 2) | — (see gap 2) |
| Money back | "$79 a month" after a let-go; "Nothing let go yet" before. Shown only once something is let go | `state.money.back` | — |
| In your Ritual | Tiles: their own things strongest, a let-go suggestion quiet with "Suggested to let go" | `progress.items` + `state.items` standings + `state.decisions` | — |
| A thing's sheet | When it sits in the Ritual and why; notes between us; Why? · Let it go · This is mine (never on things that are theirs) | Parts with `source.stackItemId`, `item.notes` | — |
| A note | Their note, then Distill's reply | `progress.items[].notes`, `result.reply` | `message(text, stackItemId)` (see gap 1) |
| Let go | Things let go, quiet, with the money back | `decisions` with `status: 'yes'` | — |
| When needed | Things they only do on certain days | (see gap 4) | — |

### Explore

| Element | What they see | Data | Engine call |
| --- | --- | --- | --- |
| Early state | "Let the Ritual settle." and things learned so far | Their study answers | — |
| Open state | An idea that fits, Add to my Ritual · Not for me | `state.today.kind === 'explore'`, `result.explore.options` | `explore`, `exploreAnswer` |

No ideas are certified yet, so everyone sees the early state.

### Settings

| Element | Data | Engine call |
| --- | --- | --- |
| Account (name, email, sign in or out) | Supabase user, `progress.name` | `/sign-in`, sign-out action |
| Gentle messages, one a day at most | Not built: shown as "Coming soon" | — (gap 6) |
| Let my nights shape my mornings | `state.person.nightsShapeMornings` | `settings(on)` |
| Wearable | `state.person.wearable`, `/connect` | Providers |
| What Distill knows | Links to the Your things section | — |
| Your data | The existing export and delete | Existing settings actions |
| Less motion | `progress.reducedMotion` | — |

---

## What changes with Claude on

Claude is off in production and stays off. With it off, the app works fully on rules and fixed lines. With it on:

- **What's coming up?** Off, a message gets a fixed thank-you and the day doesn't change. On, Haiku reads it and Opus reshapes the day, so "drinks tonight" really gives a slower Saturday.
- **Why?** Works with Claude off for a card or a named thing (the catalog's reviewed words). A free question gets a placeholder until Claude is on.
- **Notes.** Off, a note gets the fixed thank-you, and the rules learn only what they can read without a model. On, Claude reads it (people, places, feelings) and replies in their terms.
- **The reveal.** Off, the rules version. On, Claude's version replaces it when it's ready (up to a minute).
- **Card lines.** Off, fixed lines per reason. On, Claude words them.

---

## Backend gaps, for Rohan

What the new screens need that the engine doesn't give yet. Each has what the frontend does in the meantime.

1. **A note gets no reply.** `run({ kind: 'note' })` learns from the note but returns no reply, and messages in the thread aren't tied to a thing. *Meanwhile:* the app sends a note as `message(text, about: stackItemId)`, which learns, replies and keeps the thing in mind, and it keeps the note on the item in progress. *Wanted:* a reply on `note` (or `about` saved on each thread message) so a thing's notes and Distill's replies can be rebuilt from the server.
2. **"What Distill knows" isn't in the state.** `EngineState.person` has only name, season, the nights setting and the wearable. The person model's people, places, loves and occasions never reach the app, and there is no event to correct or remove one. *Meanwhile:* the chips come from what they told us in onboarding (their study answers and their own words), and a correction removes the picture line in progress. *Wanted:* `state.person.known` (people, places, values with their words) and a `forget` / `correct` event.
3. **Changes per part.** `DayOut.changed` says a day was adjusted, but not which parts or how. `lastChange` doesn't carry the version's `ops` or `changes`. *Meanwhile:* the app marks the whole changed day and finds moved or new parts by comparing it with the same weekday in the base week when it can. *Wanted:* on each changed part: the op (move, shorten, add, skip), the time before ("was 7:30"), and the reason; and skipped parts listed rather than dropped.
4. **When-needed things are invisible.** Things with an `occasion` are left off the schedule, but the state doesn't say which they are. *Meanwhile:* the app lists things on their list that aren't in any part and aren't let go, under "When needed". *Wanted:* `state.items[id].occasion` (the words, "only on travel nights").
5. **Un-ticking.** `part` with `done: false` records a skip, so there's no way to take back a tick. *Meanwhile:* a tick is one-way in the app. *Wanted:* a `part` clear (or `done: null`).
6. **Notifications.** None exist. At most one gentle notification a day, only when something is real (a changed morning, a check-in, a when-needed thing today). The settings row shows "Coming soon".
7. **Explore's state.** Explore only appears as today's card (`today.kind === 'explore'`). *Wanted:* `state.explore` (open or not, and why), so the tab knows when to open.
8. **The first Ritual's yes.** Onboarding's "Make it mine" happens before sign-in, but the engine's first version arrives later as `proposed`. *Meanwhile:* the app accepts it on their behalf once (it remembers Make it mine in progress). *Wanted (Rohan's call):* an `onboarding` event flag that composes it already accepted.
9. **An ideal day.** The real onboarding doesn't ask for one, so the first Ritual knows only taps and answers ("balcony coffee" in the prototype comes from test data). A product call for Veer.
10. **Messages with Claude off** change nothing. Expected; it's the switch, not a bug. With Claude on, `lighterByRules` still gives "Sleep in" when a reshape fails.
