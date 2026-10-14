# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS and JavaScript (native ES modules, hand-written CSS), with GSAP (ScrollTrigger, Flip, SplitText) and Lenis vendored into `public/vendor/`. No build step. Deployed on Vercel from a new GitHub repo. Confirmed by the user on 2026-10-09.

## Users

Two overlapping groups, confirmed by the user as the page's first audience:

- **Wearable owners.** 30 to 55, high income, have worn an Oura ring, Apple Watch or Garmin for six months or more, spend real money on supplements and routines, and suspect most of it does nothing. Short on certainty, not on motivation or information. Found in r/ouraring, r/Biohackers, r/QuantifiedSelf and under "is Oura worth it after a year" videos.
- **Premium gym members.** Equinox-type members who spend on services as much as on supplements: a second class membership, a recovery studio, massage credits, facials, skincare routines, app subscriptions.

The job: find out which of the things they do and buy for their health actually work for them, and get permission to stop the rest.

## Product Purpose

Distill finds out which of a person's health habits work on their body, using the data their wearable already collects, and tells them which ones they can stop doing and stop paying for. Success for the person is fewer things, the right things, and no longer wondering. Success for the landing page is a Founding 100 waitlist signup.

## Positioning

Everything in wellness sells something to add. Distill is the only product whose output is shorter than its input: it subtracts. It runs controlled on/off experiments on one person's own data and returns a verdict (kept, dropped, or inconclusive) in real units against that person's normal night-to-night swing. Competing AI coaches (Oura Advisor, WHOOP Coach, Google Health Coach) answer questions and add suggestions; none runs a controlled test or says "stop".

## Operating Context

1. The person lists their stack: supplements with doses, devices, services, memberships, routines, timings. A running count of items and dollars a month builds as they add.
2. They see the stack counted and costed.
3. Day one sort, per the Routing Table: can come off today with no test (dose too low, form not absorbed, tested and found nothing, no known way it could work, overlaps with something else, not being used); worth testing on you; can't measure it, your call; yours (clinician-sourced, hormones, diagnosed conditions; never rated).
4. Seven days of baseline: the app watches and says nothing.
5. One experiment at a time: 14 days, 3 days on, 3 days off. One instruction and one tap a day. A missed tap is "unknown", never "failed".
6. A verdict card: the habit, the number chosen before the test, the difference in real units against the person's normal swing, and one word: kept, dropped, or inconclusive.
7. A file: what they cut, and what's theirs.

Works with Oura, Apple Watch (via Apple Health) and Garmin. Not WHOOP yet.

## Capabilities and Constraints

- Wellness, not health: the product describes what a habit did to a number. It never diagnoses, treats, cures or prevents anything.
- Numbers watched: total sleep, time to fall asleep, deep and REM sleep, time awake, overnight HRV, resting heart rate, skin temperature.
- Offer: $20 a month, no lock-in. Founding 100 keep $20 a month for life. Guarantee: 60 days from the first experiment; if no experiment produces a kept or dropped verdict, the person doesn't pay.
- Not for (yet): people with no wearable, people training for a specific event, anyone whose question is driven by a medical condition.
- Status: pre-launch, waitlist only.
- Waitlist storage: Supabase table `signups` (insert-only for the public key) with `email`, `wearable` (Oura, WHOOP, Apple Watch, Garmin, Fitbit, Other), `source`, `user_agent`.
- Routing data: `data/Routing-Table-V3.xlsx` (210 items) is the source of truth; `scripts/build_data.py` writes `public/assets/data/stack.json`.

## Brand Commitments

- Name: Distill.
- Voice (from the Routing Table's Tone Guide): describe the night, never the person; the amount or the study is the problem, never the person; money is a plain figure and a plain "back"; every decision ends in the person's hands; no "should", "need to", "must"; no exclamation marks; plain words a calm friend would use.
- Words never used: wasted, useless, scam, fell for, hack, optimise, biohack, guilty, cheat day, toxins, detox, fix, cure, treat, prevent, boost, supercharge, should, need to, must, poor recovery, bad night, penalty.
- No red anywhere, product-wide. A drop is good news.
- No em or en dashes in copy.
- The user asked for a page that is premium, animation-heavy, inventive, not text-heavy, with little empty space, and not AI-looking. Reference they named: synesdj.vercel.app.
- Nothing from earlier Distill landing pages or brand work carries over (user decision, 2026-10-09).

## Evidence on Hand

- Routing Table V3 (`data/Routing-Table-V3.xlsx`): 210 items with costs, tiers, day-one sentences, verdict templates, tone guide, and a worked example stack (21 things, $1,428 a month; 10 off on day one, $767 a month back; 4 lined up for testing; 2 can't measure; 4 kept; the Oura ring protected as the data source).
- Research: Adams et al., Nature 2021 (people overlook subtractive changes).
- Absent, and must not be invented: users, testimonials, reviews, press, partner logos, usage numbers, outcome statistics, clinical claims. The "a third of tracker owners quit within six months" stat has a dead source and is not used.

## Product Principles

1. Subtract first. The product earns trust by taking things away.
2. Prove, don't assert. Every claim about a habit comes with the person's own number, or is labeled as an example.
3. Honest uncertainty. Inconclusive is a real answer and is said plainly.
4. On their side. The verdict is about the habit and the night, never about the person's discipline.
5. Less to do. One instruction and one tap a day; the interface removes decisions rather than adding them.

## Accessibility & Inclusion

WCAG AA contrast, full keyboard access to every interactive element, a designed reduced-motion path, and no information carried by color alone (lanes and verdicts also carry words).
