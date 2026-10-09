# Algorithm identity: how Distill decides

This is the decision philosophy behind every verdict, written as rules a person can read and an engine can run. The code that implements it lives in `packages/engine/src/stats/estimate.ts` (the estimate), `policy.ts` (the thresholds), `analyze.ts` (the run) and `verdict/render.ts` (the sentences). The numbers that describe how often it is right come from `pnpm sim:decide` and are kept in [DECISION-POWER.md](DECISION-POWER.md).

Where this document and the older [ALGORITHM.md](ALGORITHM.md) disagree, this one wins. The old one describes the first build, an exact randomization test that could never decide in a fortnight; that path still runs for experiments registered before this change, and nowhere else.

## Who we are when we decide

A careful friend who checked your numbers. Not a journal reviewer, not a coach.

The person is asking one question: *does this thing do anything for me, and is it worth keeping?* Everything below follows from taking that question literally.

1. **We answer the question.** Every finished test ends in one of four things: it works for you, it costs you, it does nothing we can see, or it is too close to call and here is the number. "Inconclusive" as a verdict that a design was built to produce is not allowed. If a design cannot decide, we do not run it.
2. **We estimate the size of the effect, then decide.** We never test whether an effect is exactly zero. We ask how big the change was on your nights, in units of your own normal night-to-night swing, and how sure we are of its direction.
3. **Nights are the evidence.** The unit is a night, not a three-day block. Fourteen nights is fourteen pieces of evidence. Nights near each other are alike, and the uncertainty accounts for that explicitly.
4. **The literature chooses what to test and how big an effect to look for. It does not vote on the verdict.** Your nights alone decide. The first version of this policy let the catalogue's expected effect lean on the answer, and the simulation showed it calling a null item "costs you" one time in five whenever the literature expected harm. That is exactly the bias this product exists to remove, so the prior is centred on zero.
5. **Taps are data, not purity tests.** If you tapped "didn't" on an on-day, that night counts as what it was. One skipped night does not void a fortnight.
6. **A thing has to earn its place.** When a paid item shows no detectable benefit after a full run, the verdict is Dropped, with the money. When a free habit shows nothing, the verdict says so and tells you to keep it if you like it.
7. **The rules are locked before day one.** The metric, the direction counted as good, the thresholds, the prior, the schedule and the swing are written into the registration and cannot change after the first night.
8. **We say how sure we are, in words a person uses.** "About 9 in 10 that it helps." Never a p-value, never a score about the person.

## The estimate

For every usable night we have a value (log of HRV, raw otherwise) and whether the item was on or off that night.

- **Difference.** Mean of on-nights minus mean of off-nights. For observed items (alcohol, nicotine) the difference is taken separately inside weekday and weekend nights and combined by their size, so that a habit that happens mostly on Saturdays is not credited with Saturday.
- **Swing.** The person's normal night-to-night swing, estimated robustly (median absolute deviation, scaled) from their baseline nights plus the off-nights of the test. A change is always read in units of this swing.
- **Uncertainty.** The variance of the difference is computed under a model where tonight is correlated with last night (AR(1)). The correlation is estimated from the person's own baseline and shrunk toward 0.35 so a short baseline cannot produce an extreme value. For observed items the standard error is widened by a quarter, because the nights were not assigned.
- **Posterior.** A normal prior centred on zero with a width of one swing is combined with the data by precision. With fourteen nights the data carries about three quarters of the weight; by twenty-eight, about nine tenths. The prior only keeps a noisy fortnight honest.

From the posterior we read four probabilities: that the item helps at all, that it hurts at all, that it helps by at least half a swing, and that it hurts by at least half a swing.

## The decision

Read at day 14, day 21 and day 28. The same rule applies at every look; nothing depends on how many looks came before. The schedule is the full twenty-eight days from the start, balanced within the first fortnight and again overall, so stopping early never changes what was planned.

| Condition | Verdict | Outcome |
| --- | --- | --- |
| Chance it helps at least 97.5%, and the likely size is at least 0.3 swings | Kept | it works for you |
| Chance it hurts at least 97.5%, and the likely size is at least 0.3 swings | Dropped | it costs you |
| Day 28 reached, chance of a worthwhile benefit (half a swing) at most 20% | Dropped | it does nothing we can see |
| Otherwise, before day 28 | (none yet) | too close, one more week |
| Otherwise, at day 28 | Inconclusive | too close to call, with the number |

Two guards sit in front of the table: at least five usable nights on each side, and a positive swing. Without them the look says "not enough nights" and the test continues.

"It does nothing we can see" carries a note when the nights leaned toward harm without clearing the bar, so a person is never told a harmful habit is neutral.

## What the thresholds buy and cost

Measured on synthetic people (AR(1) nights, 10% missed taps, 2% illness, the real engine end to end; full tables in [DECISION-POWER.md](DECISION-POWER.md), reference scenario):

- **When the item does nothing:** the policy wrongly says "works" or "costs you" about 7 to 10 times in a hundred (10 in the reference scenario); it correctly says "does nothing" about 60 times in a hundred; the rest are "too close" at day 28, shown with the number. With only a seven-night baseline the wrong calls rise to 14 in a hundred, which is why connecting a wearable's history (28 nights or more) matters.
- **When the effect is 1.2 swings (alcohol on HRV, late caffeine on sleep for most people):** found about three times in four by day 28, more than a third of them at the first read. Wrong direction: essentially never.
- **When the effect is 0.8 swings (the routing gate):** found about half the time by day 28, one in five at the first read. Most of the rest come back "too close" with the number, which is a real answer.
- **Observed items (never assigned):** a null item is called about twice in a hundred; a 1.2-swing harm ends as a drop about nineteen times in twenty by day 28, more often as "does nothing, and the nights leaned the other way" than as "costs you", because of the wider error.

The honest promise this supports: **a first read at fourteen days, and a verdict by twenty-eight.** A clear effect often resolves at fourteen; a modest one needs the month. The old copy that promised a verdict in fourteen days was never true of any design that respects the person's noise, and should not return.

## Where the weights are

Everything that steers a decision, in one place:

- **Which items get a test at all:** the catalogue's expected effect, gated at 0.8 swings, and ordered largest first. Below the gate, a person can still choose to run it, told up front what to expect.
- **Which number is watched:** the person's goal, through the Goal to Number sheet, locked at registration.
- **How much each night counts:** once, with the correlation between neighbouring nights reducing the information two adjacent nights carry.
- **How the literature enters:** only through what is tested and how large an effect is looked for. Prior centred on zero, width one swing.
- **How observed nights are discounted:** weekday and weekend compared separately; standard error widened by 25%.
- **What counts as worthwhile:** half a swing.
- **How sure we need to be:** 97.5% for a directional call; a worthwhile benefit less than 20% likely for "does nothing".
- **Cost:** decides the sentence and the money line, never the verdict.

## What this is not

- Not a medical claim. Every sentence is about a habit and a number.
- Not population science. The estimate is about one person. The aggregate across people is a separate asset with separate rules, not yet built.
- Not a guarantee of truth. About one null item in ten will get a directional call it did not earn. The sentences say how sure we are so the person can weigh that.

## Changes to this policy

A change to any number above is a new policy version. Running experiments keep the version they were registered under; the registration record carries the whole policy so a saved verdict can always be reproduced. Re-run `pnpm sim:decide` and update [DECISION-POWER.md](DECISION-POWER.md) before shipping a change, and record the reason in [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
