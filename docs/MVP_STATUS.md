# MVP status

The project now has a data foundation, the core of a day-one audit engine, an experiment engine with private storage, statistical analysis, and a simulation/demo-data system. It is not yet an app a new person can use from start to finish.

## What the code does in plain English

The spreadsheet has become a checked, structured product catalog. The code knows the 210 items, the questions to ask, the costs, and the individual rules. It can tell a low-dose product from a different form of the same product, instead of treating every bottle with the same name equally.

The data layer can connect to supported wearable services or import Apple Health and CSV files. It translates different services' data into one format, keeps missing measurements separate from zero, encrypts connection credentials, resumes interrupted history downloads, and implements account-data deletion. These paths still need real-account acceptance with configured services.

The new stack router combines those individual rules into a proposed day-one audit. It checks protected items first, handles unused items and defined overlaps, adds up spending and proposed savings, and ranks measurable candidates for future experiments. It keeps the products in an overlap together so a later screen can show the choice. When information is missing or the spreadsheet disagrees with itself, it asks for clarification or marks the item for review.

The experiment engine can choose one candidate, watch a baseline, create a repeatable Monday-start schedule, and save the measurement and rules before the test begins. It records daily compliance, distinguishes missing answers from skipped items, supports exclusions and switching, and can compare past nights as hypotheses. Database rules prevent changing a saved test or running two at once.

The statistics engine compares on and off nights, shows the change against the person's usual variability, and produces Kept, Dropped or Inconclusive. New experiments ask whether the saved on condition helps or hurts, with stricter evidence needed in each direction; existing experiments retain their saved rules. Missing data, broken compliance and observational comparisons cannot quietly become decisive results. A separate result-card payload keeps internal p-values out of the eventual screen.

The new simulator creates fictional people, adds known helpful/harmful effects, and runs the actual experiment code to see how often it finds an answer or makes a mistake. The power report compares test lengths, missed answers, baseline lengths, correlation, all ten outcomes and interval coverage. Three demo people now have six months of stored history, a Worked Example inventory, completed experiments and results available through a local read-only API. No wearable or live account is needed to seed them.

The verdict renderer now turns the calculated results and routed items into short readable text. It fills all 17 source templates, rounds numbers, adds known source/use context, and checks every completed string's tone. Accurate variants explain incomplete or inconclusive tests, avoid invented savings from restrictions and keep Protected items neutral. Demo API results now include these narratives. See [VERDICTS.md](VERDICTS.md).

These are backend capabilities. There is no onboarding or morning check-in screen, visual result card or personal results file yet. The simulations are evidence under stated assumptions, not proof for real users. The existing public landing page is separate from the application.

## Progress toward the specified MVP

| Phase                         | Status                                                                 | What it contributes                                                                                                                                |
| ----------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1: Catalog and item rules     | Implemented and locally tested                                         | The checked source catalog and rules for each item.                                                                                                |
| 2: Wearable data and accounts | Implemented and locally tested; live acceptance pending                | Imports, OAuth, account auth, private storage, backfill, sync, deletion.                                                                           |
| 3: Day-one stack audit        | Core implemented and locally tested; worked-example acceptance blocked | Complete-stack routing, spending/savings, explicit overlap decisions, test ordering, strict source diagnostics.                                    |
| 4: Experiments                | Implemented and locally tested; live migration pending                 | Candidate selection, baseline, seeded schedules, immutable registration, compliance, switching and history hypotheses.                             |
| 5: Statistics                 | Implemented and locally tested; simulation limitations documented      | Personal swing, actual on/off effects, exact block randomization, internal bootstrap interval, locked decision policies and safe result-card data. |
| 6: Simulation and demo people | Implemented, measured and locally tested                               | Synthetic people, full Monte Carlo report/chart, scoped power labels, and three persistent demo profiles with six months of history.               |
| 7: Verdict text               | Implemented and locally tested                                         | All 17 filled templates, contextual variants, rounding, tone/snapshot checks and demo API narratives.                                              |
| 8: App screens                | Pending                                                                | Connect, onboarding, day-one audit, daily check-in, verdicts, personal file, settings.                                                             |

The remaining work includes app screens, a complete demo journey and live acceptance. The specification also requires a successful Oura test-account connection. Simulation found limits that must stay visible when choosing the product protocol.

## Current blockers and next work

Phase 3's strict example check cannot pass until the conflicting totals, conditional rules, and missing example answers are reviewed. [ALGORITHM.md](ALGORITHM.md) explains exactly what fails. Proposed savings from the conservative implementation should not be advertised as the example's $767 result.

Real integrations need Supabase/Vercel configuration and approved provider accounts. Google Health access and Garmin partner approval remain external dependencies. Source fact-check flags still require team sign-off before launch-facing advice is approved. [DATA_SOURCES.md](DATA_SOURCES.md) lists the setup and acceptance steps.

The saved 14-day schedules satisfy balance and minimum-night capacity, but have too few possible assignments to support a decisive result under either statistical policy. They return Inconclusive even for a large change. Phase 6 compares longer layouts; the explicit 42-day reference is available with scoped power guidance. The duration offered to users still needs a product decision. See [ALGORITHM.md](ALGORITHM.md) for the exact layouts and decision table.

Phase 6 found about 38% power at 0.8 swings and 70% at 1.2 for the 42-day reference, with false positives around 5% under independent exclusions. These claims do not apply to the 14-day default. A deliberately biased missing-answer stress test exposes the assumption’s limits. The nominal 90% bootstrap interval undercovers in some profiles and is hidden from public cards. [POWER.md](POWER.md) contains counts and uncertainty; [DEMO.md](DEMO.md) contains local seed/API instructions.

The 0.8 routing threshold remains a candidate-priority rule. Source good/fair/low labels are preserved for review; a separate empirical overlay describes only supported simulated protocols. Choosing whether to offer four or six weeks, and how to handle outcome-dependent missed answers, remains a product/algorithm decision. Phase 6's complete study was rerun for this verification and all 142 cells reproduced exactly. Phase 7 is implemented; Phase 8 is the next code phase and connects these outputs into the demo app.
