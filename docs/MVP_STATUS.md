# MVP status

The project now has a data foundation, the core of a day-one audit engine, an experiment engine with private storage, and statistical analysis. It is not yet an app a new person can use from start to finish.

## What the code does in plain English

The spreadsheet has become a checked, structured product catalog. The code knows the 210 items, the questions to ask, the costs, and the individual rules. It can tell a low-dose product from a different form of the same product, instead of treating every bottle with the same name equally.

The data layer can connect to supported wearable services or import Apple Health and CSV files. It translates different services' data into one format, keeps missing measurements separate from zero, encrypts connection credentials, resumes interrupted history downloads, and implements account-data deletion. These paths still need real-account acceptance with configured services.

The new stack router combines those individual rules into a proposed day-one audit. It checks protected items first, handles unused items and defined overlaps, adds up spending and proposed savings, and ranks measurable candidates for future experiments. It keeps the products in an overlap together so a later screen can show the choice. When information is missing or the spreadsheet disagrees with itself, it asks for clarification or marks the item for review.

The experiment engine can choose one candidate, watch a baseline, create a repeatable Monday-start schedule, and save the measurement and rules before the test begins. It records daily compliance, distinguishes missing answers from skipped items, supports exclusions and switching, and can compare past nights as hypotheses. Database rules prevent changing a saved test or running two at once.

The statistics engine compares on and off nights, shows the change against the person's usual variability, and produces Kept, Dropped or Inconclusive. New experiments ask whether the saved on condition helps or hurts, with stricter evidence needed in each direction; existing experiments retain their saved rules. Missing data, broken compliance and observational comparisons cannot quietly become decisive results. A separate result-card payload keeps internal p-values out of the eventual screen.

These are backend capabilities. There is no onboarding or morning check-in screen, rendered result card, or personal results file yet. Statistical protocol performance still needs simulation. The existing public landing page is separate from the application.

## Progress toward the specified MVP

| Phase                         | Status                                                                 | What it contributes                                                                                                                      |
| ----------------------------- | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| 1: Catalog and item rules     | Implemented and locally tested                                         | The checked source catalog and rules for each item.                                                                                      |
| 2: Wearable data and accounts | Implemented and locally tested; live acceptance pending                | Imports, OAuth, account auth, private storage, backfill, sync, deletion.                                                                 |
| 3: Day-one stack audit        | Core implemented and locally tested; worked-example acceptance blocked | Complete-stack routing, spending/savings, explicit overlap decisions, test ordering, strict source diagnostics.                          |
| 4: Experiments                | Implemented and locally tested; live migration pending                 | Candidate selection, baseline, seeded schedules, immutable registration, compliance, switching and history hypotheses.                   |
| 5: Statistics                 | Implemented and locally tested; protocol validation pending Phase 6    | Personal swing, actual on/off effects, exact block randomization, 90% bootstrap interval, locked decision policies and result-card data. |
| 6: Simulation and demo people | Pending                                                                | Check the algorithm against known simulated effects and make demo accounts usable without a wearable.                                    |
| 7: Verdict text               | Pending                                                                | Produce the final readable result cards from the spreadsheet's templates and check their tone.                                           |
| 8: App screens                | Pending                                                                | Connect, onboarding, day-one audit, daily check-in, verdicts, personal file, settings.                                                   |

The remaining work is not just screens. A working MVP needs evidence from simulation that the statistical protocol behaves correctly, readable verdicts, and the complete demo journey. The specification also requires a successful Oura test-account connection.

## Current blockers and next work

Phase 3's strict example check cannot pass until the conflicting totals, conditional rules, and missing example answers are reviewed. [ALGORITHM.md](ALGORITHM.md) explains exactly what fails. Proposed savings from the conservative implementation should not be advertised as the example's $767 result.

Real integrations need Supabase/Vercel configuration and approved provider accounts. Google Health access and Garmin partner approval remain external dependencies. Source fact-check flags still require team sign-off before launch-facing advice is approved. [DATA_SOURCES.md](DATA_SOURCES.md) lists the setup and acceptance steps.

The default 14-day schedules satisfy balance and minimum-night capacity, but have too few possible assignments to support a decisive result under either saved statistical policy. Phase 5 returns Inconclusive for that reason, even for a large measured change. Longer configurable layouts can make a decisive result possible, but ties, carryover and missing nights can still prevent it. They need simulation before becoming a product default. See [ALGORITHM.md](ALGORITHM.md) for the exact layouts and decision table.

The next code phase is Phase 6: realistic synthetic people, Monte Carlo validation, the power report and demo history. It must check false positives, wrong-direction decisions, autocorrelation, exclusions and interval coverage, then confirm or revise the schedule and effect gate. Phases 7–8 will render verdicts and connect the capabilities into the end-to-end demo path.
