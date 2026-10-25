# The 41: fixes collected from Veer's review

Collected while Veer reviews (from 25 October 2026). Fixed together once he finishes a batch, so results don't shift under him mid-review. Each line names the person it came from.

## Rules Veer set

### Habits that cost them (late caffeine, energy drinks, nightcaps, nicotine)
*Veer, 25 Oct.* Enjoying it doesn't change the advice. Only "it's non-negotiable" (theirs) changes the wording, and even then, when it's clearly harmful (a Monster at 6pm), Distill still gently asks them to reconsider or offers an alternative. Never shaming, never "stop".

What this changes in code:
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

## By person

### aaron-39
- Monster: the key expects a gentle card he answers "not now" during doubles. Distill only said "Monster stays" (the cost-habit rule above).
- Coffee after 2pm: kept with "stays part of your days" (the cost-habit rule above).
- CPAP (his doctor's) doesn't appear in his first Ritual.
- Melatonin at 10 mg, well above the studied doses: Distill said nothing (check `DOSE` rules: a high dose, not only a low one).

## Review page fixes (done)
- "Their answer" now reads "Taps a card", with the card's own words above each tap.
- Grades for a cost show "cost" under the letter.
