# Routing table v4: the human layer (brief for Ishan)

Distill moved from "test your habits" to a companion that helps people know themselves and their stack ([DIRECTION.md](DIRECTION.md)). The routing table's evidence stays; it needs a second, human layer, and a priority order, so the app can talk about the 50 things people actually do as well as it talks about doses.

Don't rebuild V3. Add columns, demote a few, and finish the top 50 rows first.

## Keep: the evidence layer

Name, category, typical monthly cost, usual goal, evidence grade and summary, lowest useful dose, mechanism, drop reason, overlap groups, safety notes, the metric an item could move, the follow-up rule columns. These still decide what can be let go and why.

## Demote: engine only

Test design, speed, on/off days, "runnable this semester", chance of a clear result, the effect-size gate as the main router (T1 / T3 too small). The engine can keep reading them; nothing the person sees is organised around testing any more.

## Add: the human layer

One column each, on the Items sheet, filled for the top 50 first:

| Column | What it holds | Example (Equinox) |
| --- | --- | --- |
| Short name | What a person calls it, 1 to 3 words | Premium gym |
| How common | 1 to 5, among our people (women and men 22 to 35 who spend on wellness) | 4 |
| Comes from | Where it usually enters a life: TikTok, Instagram, podcast, friend, doctor, gym, brand | friend, gym |
| Why people love it | Up to three of: connection, ritual, confidence, looks, calm, energy, belonging, treat | belonging, confidence |
| The human question | One question a friend would ask, in plain words, under 12 words | "What do you go for, honestly?" |
| What fits instead | One idea for when it no longer fits: a lighter, cheaper or more personal version | A class pack with a friend |

The app already carries short names for every row in code (`apps/web/lib/catalog/short-names.ts`); the column moves them into the source and lets you correct them.

## Priority: the top 50

Rank every row by **how common × typical monthly cost**, and finish the 50 highest first. They cover most real stacks; the other 160 keep working on the evidence layer with generic wording until they get their turn.

## Handover to the app

`packages/catalog/src/ingest.ts` reads the Items sheet by column letter. Adding the six columns at the end of the sheet (after the current last column) keeps every existing mapping valid; tell Veer or Claude the letters and the catalog build will pick them up, with a check that the top 50 are complete.
