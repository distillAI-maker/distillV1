# The 41: fixes collected from Veer's review

Collected while Veer reviews (from 25 October 2026). Fixed together once he finishes a batch, so results don't shift under him mid-review. Each line names the person it came from.

## Rules Veer set

### First: what we're for (Veer, 25 Oct)
Distill builds each person's own Ritual, fully them, and adapts it on the fly so anxiety stays down and they feel confident: growth mindset and human exploring. We never try to perfect a routine; human life never works like that. Two jobs:
- **The base:** make it as good as possible from what they value and their goals. This is the only place a swap for a habit that costs them belongs.
- **The day:** life happens (a late night, a hangover Saturday, good memories). Distill never corrects it after the fact. It encourages them and reshapes the day from that point on, with no judgment.

Every fix below is checked against this. If one makes Distill feel like it's policing their life, it's wrong.

### Habits that cost them (late caffeine, energy drinks, nightcaps, nicotine)
*Veer, 25 Oct.* Enjoying it doesn't change the advice. Only "it's non-negotiable" (theirs) changes the wording, and even then, when it's clearly harmful (a Monster at 6pm), Distill still gently asks them to reconsider or offers an alternative. Never shaming, never "stop".

**Done, 25 Oct (branch `cost-habits`):** applies to habits with strong or good evidence of a cost (late coffee, extra coffees, afternoon matcha, energy drinks, evening drinks, nicotine). Mixed-evidence ones (late dinner, dessert, late work email, the sleep score, weekend lie-ins, a phone in bed) still follow their values. *Veer:* when their own words tie it to people, a tradition or their job ("wine nights with friends", "shop tradition", "it's literally my job"), it's theirs and left alone; "Mostly with people I love" on the company card now means theirs too. Swaps go to solo and autopilot habits. Their nights are never corrected.

Still open:
- "This is mine" on a clearly harmful habit: Veer wants one gentle reconsider much later (about 90 days). Not built yet.
- Mixed-evidence cost habits can still be planned into the Ritual (Kenji's "Phone in bed").
- With Claude off, the swap uses the catalog's `fits_instead`, which sometimes fits a social night better than a solo one (Simone: "same plans, with the last drink a little earlier"). Claude would fit it to her.

What this changed in code (original notes):
- `unlovedHabit` (decide.ts) protects a cost item when they love it, or when they haven't said and the row's `why_loved` is social ("treat", "ritual", "connection"). That's why Aaron's Monster and late coffee were kept. Replace it: cost items are raised whatever the attachment, worded by attachment (unknown: ask; loved: honest swap; theirs: reconsider, never pushed again for a while).
- Harm depends on timing (a 6am Monster costs far less sleep than a 6pm one). Use the item's moment and the person's day before deciding how strongly to raise it.
- Never a "stays part of your days" card for a cost item.
- Cost items aren't placed in the first Ritual as planned parts.
- The `EVIDENCE` prompt says to raise a cost "only when they aren't doing it with people they love". *Veer, 25 Oct:* drinks with friends are raised too, gently. Change the prompt to match.

### What "gently" means (proposed to Veer, 25 Oct)
1. **A question, never an instruction.** "Want to try…?", never "you should" or "stop".
2. **Keep what they love about it.** The friends, the night, the treat stay; the swap changes one detail (the last drink a little earlier, the second one alcohol-free, the can before 2pm).
3. **One plain reason, about how they'll feel.** "It's been taking a bite out of your sleep." No numbers, no studies, no scare words ("dangerous", "addiction", "risk").
4. **Once, at a calm moment.** Never the morning after a night they told us about, never on a hard week (their season), never as a reply to a happy message.
5. **Their answer holds.** "Not now" rests it 30 days (as today). "This is mine" rests it about 90 days, then one more gentle check-in at most. Loved things are never talked down: we can offer a swap, never judge the thing.
6. **Safety is the exception.** A safety note for a condition they told us about (pregnancy, diabetes, a medicine) is said plainly, once, and pointed to their clinician.
7. **It's about the base, never the night.** The offer shapes their usual week, once. When they go out late anyway, Distill says nothing about it; it lightens tomorrow morning (the reshape that already exists) and keeps them going.

### Mixed evidence that costs money, and "stays" (Veer, 25 Oct, on Tomás)
Too many things read as kept. **Done (branch `felt-and-quiet`):**
- "No reason to change it" (NOTHING_TO_CLEAR) is never a card and never "kept": the app shows it as their call, and The 41 lists it in one quiet line.
- A new card for paid mixed-evidence things: "Can you feel Normatec doing something for you?" (Yes, I can tell / Not really / Not sure). "Not really" offers to let it go (NOT_FELT), with the money back. Never for free things, loved or theirs, well-founded ones, or habits that cost them.
- The 41 shows "What Distill would ask next" for each person: 73 cards across the 41.
- Wording fixes: you "use" a massage gun or an app (you "go to" a class), and the company card is only for things people share and haven't told us about.

### Consistency (Veer, 27 Oct)
People buy things, aren't consistent, and that's why they don't work. **Done (branch `anchor-it`):** a well-founded thing that builds with daily use, done on fewer than about 20 days a month, gets "Want it next to your morning coffee or breakfast, so it happens without thinking?"; a yes puts it there in their Ritual every day. New catalog column `builds` (14 rows yes). In The 41: Elena's and Nora's Calm, Ethan's ashwagandha (next to his daily creatine).

## By person

### aaron-39
- Monster: the key expects a gentle card he answers "not now" during doubles. Distill only said "Monster stays". **Fixed:** a swap card, which he answers "not now".
- Coffee after 2pm: kept with "stays part of your days". **Fixed:** no card; the company question comes first.
- CPAP (his doctor's) doesn't appear in his first Ritual.
- Melatonin at 10 mg, well above the studied doses: Distill said nothing (check `DOSE` rules: a high dose, not only a low one).
- *Veer, 25 Oct:* the swap guessed why he drinks it ("when it's mostly the fizz"). Late caffeine usually patches short or poor sleep; the real swap is a better base (sleep habits, an earlier wind-down) so he feels fresher and needs the late can less. **Done for the words:** energy drinks' `fits_instead` now reads "A smaller can before 2pm, and an earlier wind-down, so the afternoon dip asks for less caffeine." **Still open (Claude on):** link a caffeine swap to their sleep in the base Ritual, and teach the prompt to look upstream like this.

### ravi-31
- *Veer:* an Oura and a WHOOP at once is unlikely. **Done:** he switched from the WHOOP to the Oura and never cancelled it (still tests the second wearable).

## The set itself (Veer, 26 Oct)
- Too few people go out. **Done:** Britt, Ethan, Jordan, Mei, Nora, Fatima and Amara now have nights out in their ideal days, and six send a "going out tonight" message, which tests reshaping the next morning.
- Everyone seemed to sleep about 5 hours. That was only the one short night each person was written to test; the test already played four weeks of ordinary nights around 7 hours, unseen. **Done:** each wearable person has their own usual (5h 40m for Grace, four months postpartum, to 7h 15m for Ravi), shown on the page, and every short night still reads as short against it.

## Review page fixes (done)
- "Their answer" now reads "Taps a card", with the card's own words above each tap.
- Grades for a cost show "cost" under the letter.
