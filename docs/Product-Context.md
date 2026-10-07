# Distill: product context and decisions

The product thinking behind Distill, distilled from the founder's long working chat with Claude (September to October 2026). It records where the idea landed, why, and what was tried and killed along the way. The landing page docs (`Distill-LP-Copy-v3.md`, `Design-Research.md`) and `Emotional-Positioning-Research.md` cover the page and the tone research; this file covers the product.

Where the chat contradicts itself, the later decision wins and is recorded here. Open questions are listed at the end, not papered over.

## Context

- Distill started as the project for the AI-Assisted Product Development class (UC Berkeley, fall 2026). Teams were picked on 14 September; **the MVP launches around 16 October 2026**; the final pitch is 5 December.
- **The goal is a genuinely great product:** the real solution to this problem, built so it could scale. Users and revenue follow from that. Some teammates care more about users and revenue directly; the shared focus for now is the product.
- **Team:** Veer leads business, strategy and product, and also vibe codes. Ishan and Rohan both code; Ishan owns the routing table. Design and prototyping use AI tools (Figma Make, Lovable), and the code is written with Claude Code and similar tools.
- Class process to follow: ideation (Mobbin for references) → wireframing (Figma Make, with a design system loaded) → clickable prototype (Lovable, v0 or Replit) → live code (Claude Code, Cursor). Iterate flow first, then content, then visuals.
- A professor's B2C advice the founder treats as a rule: B2C products win on emotional connection, simplicity and personalization, the "joy" people can't quite explain.

## The problem

Every input in modern life sells addition: buy this, take this, try this, track this. Social media, influencers and brands all profit from adding to your routine, and nobody's job is to subtract. People pile up supplements, services, devices and habits, can't tell which of it works for them, and end up overwhelmed, anxious and feeling behind.

- **Backing:** Adams et al., *Nature*, 2021. Across eight experiments, people asked to improve something systematically failed to consider removing anything. Treat this as the intellectual backbone of the pitch.
- **Wearables made it worse, not better.** A number that moves daily, a paragraph explaining it, and still no idea which habit is responsible. Data added anxiety without adding a decision. "Orthosomnia" (JCSM, 2017) is the named clinical version; the sub-clinical version is far wider.
- **The real pain, in a user's own words (from an interview):** "I try and be disciplined but the anxiety it causes me wears it off."
- **The founder's framing:** we believe in finding what works *for you* and better habits, not shortcuts. The point is enjoying life, not optimizing harder.

## Who it's for

- **ICP:** people already spending real money and effort on their wellbeing who can't tell which parts are theirs. Not lazy, not uninformed: saturated. The founder widened this from "biohacker with thirty bottles" to **anyone who can afford an Equinox membership and wants to look and feel great**. Services (gym, Pilates, facials, IV drips) cost more than supplements, so the numbers land harder.
- **Beachhead** (a findable room, not a demographic): women roughly 22 to 32 in the reformer Pilates, skincare and supplement world, reached through TikTok and Instagram content; and wearable owners in r/ouraring and r/whoop, who are the only ones who can get data-backed reads on day one.
- **Launch geography:** NYC, LA and Miami after graduation. For the class, any five real target users will do.
- **Not for, yet:** anyone whose question is driven by a medical condition, and anyone training for a specific event.

## The product

One line: **an app that works out what your body actually runs on, so you keep what's yours and let the rest go.**

Cutting is a consequence, not the goal. The founder pushed hard on this: Distill is about crafting your own wellness identity (closer to the feeling of Calm, but with proof underneath), not an austerity app. Say the beautiful thing to the market; keep the concrete thing ("we tell you what your body actually responds to") next to it at all times.

### Onboarding (8 screens)

1. **Open:** the wordmark "Distill" fades up, then becomes the sentence "Distill your life." Auto-advances.
2. **Inventory:** tappable chips in six categories (supplements, devices, services, habits, timing, environment), with a running count pinned at the bottom. Each chip gets an optional one-tap "where'd this come from?" (TikTok, friend, podcast, doctor, ad, can't remember). Asking about provenance inline feels like a confession; asking later feels like an interrogation.
3. **Follow-ups:** at most 8 questions.
   - **Person-level:** which wearable and for how long; which items a doctor prescribed (these become Protected); an open "why are you here?" rant box; and "what would you hate to give up?" (sacred items are never tested or cut).
   - **Item-level, only when the answer changes the routing:** dose and form for supplements, frequency for anything not daily, clock time for anything touching sleep, and price for services only (common products get an estimated price).
4. **The number:** the one dark, cinematic screen. The user's item names float and gather, then "23 things" appears, then "$212 a month," then a quiet line that there's no evidence most of it is doing anything for them. It is the emotional peak, and it is private, not something users are expected to share.
5. **The sort:** soft circular clusters, closer to a beauty brand (Rhode) than a dashboard: worth reading on you; drop these now; can't be measured but might matter; yours, we won't touch these.
6. **Day-one drops:** items you can stop today, with their cost shown and the reasoning blurred until signup. Blur the reasons, never the list.
7. **Paywall.**
8. **Connect:** Oura or manual entry, motivated by "six of your items can be read against your own data". Then the baseline period.

Key sequencing insight: the count, the cost and the day-one drops need **no wearable data**. Two rounds of value land before the app asks for any access.

### After signup (4 screens)

- **Today:** *Under review. Veer's note: "one quiet line" is too laid back. Simplicity is how Distill gets attention, but the product's job is to actively reshape identity, to be more human than today's hyper-anxious world. Rethink this when designing Part 2.* Earlier version: one line, nothing to check. "Magnesium's on tonight," never "night 4 of 6." No progress bars, no daily numbers.
- **Verdict:** your own numbers with and without the item, one plain sentence, and one of: it works, keep it / it does nothing, here's the money back / too close to call, and we won't pretend otherwise.
- **Your spec:** two lists, what's yours (proven, protected or loved) and what you let go, with the item count and monthly cost above. This is the retention object. Copilot Money and Rocket Money are the structural references.
- **Item detail:** tier and why, cost, where it came from, and its result. Items that can't be measured get an optional one-tap daily rating. Protected items show their reason and nothing else.

## How it works underneath

- **Three inputs:** the inventory (what you do and buy), wearable data (what your body did), and when you did each thing.
- **Routing table:** a reference library, built by Ishan in `docs/Routing-Table.xlsx` and exported to `public/routing.json`. It classifies each item by claimed outcome, which wearable metric could show it, how fast it washes out, and the strength of evidence at real-world doses. Each item routes to one of these:
  - **Protected:** prescribed or monitored by a doctor. Never touched.
  - **Settled without a test:** a dose too low to matter, no plausible mechanism, or not actually being used. Dropped on day one with a reason.
  - **Tested on you:** a wearable can see the effect, and the effect is big enough to detect. Alcohol, caffeine timing, late meals, evening training, room temperature, cold and sauna come first.
  - **Can't measure:** facials, collagen, most skincare, anything cumulative. Shown with its cost and evidence; the user decides.
- **Effect-size gate:** only offer a test when the expected effect is about 0.8 or more of the user's own day-to-day swing. With 7 nights on each side, you need roughly 1.3 to 1.5 of that swing to detect a change. Alcohol on HRV and caffeine on sleep pass; magnesium on deep sleep does not.
- **Report magnitude, not significance:** "costs you about 18% of your recovery, give or take 6" beats "inconclusive." Fix the outcome metric and threshold before any test starts, with no fishing for results afterwards.
- **Rules for the LLM:** it maps free text onto library entries, ranks hypotheses and writes sentences. It **never produces a number** and never assigns a tier. Numbers come from a fixed statistics function.
- **The moat** is not the library, which anyone could rebuild from the literature. It is the results database that builds up on top: real effect sizes across many individuals, plus the provenance data showing which sources produce habits that don't survive testing.

## Brand ethos

- **Extremely luxury-oriented.** Distilling is itself a luxury idea: reducing something to its purest, most precious form. Luxury is the edited version, not the most.
- **Thesis:** greatness isn't grinding. It's the life you actually want, on your own terms, and it starts in the mind. The mind shapes action, and action shapes reality.
- **Pride comes from taking the next step and choosing, not from chasing or achieving.** Never frame anything as "become more"; frame it as being proud of the life you chose.
- **Language:** "your standard" and "who you are when you're at your best", never "optimize".
- **The "we get you" moment** covers who they want to be: the routine they want, their hobbies, the beautiful times with friends and family. Not only why they keep buying things.
- **The spec** reads like a tailor's fitting card, not a checklist.
- **Day to day** feels like hospitality, not coaching. The wine-Friday morning gets the treatment a great hotel would give: no judgement.
- **Visuals:** editorial and crafted, built around human stories and well-made things. Closer to a magazine than an app.

## Tone

Distill is a thriving, supportive friend, not a coach and not a scold. The full rules are in `Emotional-Positioning-Research.md`. The key moves:

- **Price choices instead of forbidding them.** "Wine nights cost you about a day. Worth it sometimes. Now you know."
- **The morning after a good night out is the most valuable moment in the product,** because it's exactly when every competitor shows a red score and leaves.
- **Sacred items get coached, not tested.** If coffee is non-negotiable, teach water first, waiting 90 minutes, and a rest-day coffee with friends.
- **Language to avoid:** never "testing phase," "experiment" or "n-of-1" in the product. Never red, scores or streaks. Never make wellness claims that cross into health claims ("fixes insomnia").
- **The feeling to sell:** "I know myself and I'm not behind."

## Business and go-to-market

- **Price:** $20/month, no lock-in. The Founding 100 keep that price for life.
- **Guarantee:** in 60 days we'll identify at least five things you can cut and show what each was costing you. This is deliverable from the inventory and library alone. Earlier versions tied the guarantee to statistical significance, which was fragile.
- **The guarantee has a gap for the widened ICP.** An Equinox-type user may not have five supplements that fail on dose or form. The day-one category therefore needs a second kind of cut: redundant services, such as overlapping subscriptions, classes you no longer attend, and devices sitting in a drawer.
- **Latent pain means demand has to be created, not captured.** Nobody searches for this product. Find the trigger moments (a credit card statement, a renewal decision, a shelf of unused bottles) or create them with content, such as a free "add up your stack" calculator.
- **No B2B for now, and no sponsorships, affiliates or paid placements.** Wearable platform terms (WHOOP's especially) bar passing member data to third parties. A paying gym or brand would also undermine the independence users trust, especially on in-house add-ons like IV drips. B2B with clinics, clubs or hotels remains a possible later expansion.
- **Vision:** your spec now → a real-world map of what works, for whom and at what dose → recommending environments and spaces that suit your body. That last step connects to the founder's long-term interest in wellness spaces.
- **vs ChatGPT:** ChatGPT gives the population answer and never tells you to stop. Distill has your physiology, a record of what you did, and the comparison between them.

## Tech decisions

- **Web app first** (Lovable or Claude Code, with Supabase and Vercel), using Oura OAuth plus manual entry.
- **MVP is a web app** (launch target around 16 October 2026). A URL ships the same day. Native iOS adds an Apple developer account, TestFlight or App Store review, and a harder build, which is too much risk for a 14-day launch.
- **Native iOS after the MVP.** Apple HealthKit, needed for Apple Watch, Garmin and Fitbit data, requires a native app (React Native with Expo is the likely route). With Ishan and Rohan coding it's realistic, but only once the web MVP is in people's hands.
- **Write backend jobs in Claude Code, not Lovable:** the nightly data pull (Supabase cron), OAuth token refresh, and the statistics function.
- **Have someone who knows statistics review the stats function before launch.**
- **Build an eval set** of about 20 fake user profiles before changing any prompts. Log hypotheses that get picked or vetoed; vetoes are the best quality signal.

## Brand

- **Name:** Distill. "Distill" is common in software, so the identity has to carry the brand, and availability needs checking.
- **Direction (current, October 2026):** spiritual, luxurious, calm greatness. It evolved from D4 "Distillate" (a soft-teal sanctuary feel), which came to feel too soft and babyish. Figma Make develops the palette and type from a mood-led prompt, not fixed tokens. Avoid looking like a fitness app, a spa brochure or a beauty brand.
- **Earlier D4 tokens (superseded, kept for reference):** `#FAFAF7`, `#EEF3F2`, `#D6E6E3`, `#0F5C57`, `#15211F`; Italiana, Figtree, DM Mono.

- **Signature devices:** the scoreboard that goes down (23 → 9, $212 → $84) and the two lists. Avoid the 14-night strip, decorative "rigour" marks, and a strikethrough in the wordmark (it's a judgement gesture).
- **App references on Mobbin:** Rise Science, Bevel and Waking Up for Today; MacroFactor for the verdict; Copilot Money and Rocket Money for the spec; Spotify Wrapped and Copilot's summaries for the number; Rhode, Glossier and Ssense for the sort; Equinox, Soho House and Aman for overall texture. Use Oura only as a negative reference.

## Ideas tried and killed (and why)

1. **Environment actuation layer:** the wearable drives screen colour, audio, lights and calendar, based on the Sensory Spaces schemas. Killed because, without lights and thermostats, it is only a feature; the hardware dependency and the macOS screen agent were too hard; and removing user control went against the professors' point that people want choice and control.
2. **Photo-a-room diagnosis:** rejected by the founder.
3. **B2B clinic or club offer:** blocked by data-sharing terms, the conflict of interest, and the semester's focus on shipping.
4. **Assigned 14-day on/off experiments as the default:** compliance kills it, it feels like homework, and most effects are undetectable. It was replaced by reading variation already in the user's history, with a test only as an opt-in escalation.
5. **"Subtraction service" framing:** too austere. It was replaced by identity and "your spec".

## Open questions

- **History-read vs assigned tests.** The later chat decided the default is reading variation already in the user's data, with assigned tests as opt-in only. The live landing page still presents the 14-day, 3-on/3-off test as the core mechanic (`public/index.html`: the "how it works" days strip and the verdict explorer). Reconcile the two before the app build. A routing column for "can be read from history: yes/no" would make the decision explicit.
- **Routing table changes requested of Ishan:**
  - Already done: the expected-effect-size column and the 0.8 gate (`build_routing.py`, "Tier after the effect gate"), and follow-up questions that change effect sizes (the `RULES` table).
  - Still open: a redundant-services category for day-one cuts, and sources for every row that tells someone to stop paying for something.
- **Product decisions still open:** where exactly the paywall sits (likely after the number, before connect), and whether the sort screen stays in the flow.
- **Untested belief to check in interviews:** that people feel guilt or defensiveness when they see a bad score after a good night. Ask what they feel and what they do next.
- **The test for the onboarding prototype:** show it to five real target users and ask whether they feel lighter or heavier afterwards.
