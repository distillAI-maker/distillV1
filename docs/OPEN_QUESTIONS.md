# Open questions

These are team decisions or source inconsistencies, not evidence corrections made by the implementation. The supplied workbook and SPEC are retained unchanged.

## Source issues discovered in Phase 1

| ID | Source | Issue and current handling |
| --- | --- | --- |
| VERSION | Start Here!A1, A9 | Title says version 3 and a section says version 4. Keep the supplied V3 filename and hash the bytes. |
| GROUP_COUNT | Overlap Groups!A5:A22; SPEC section 1 | There are 18 groups, not 19. All 18 group memberships validate; no invented nineteenth group. |
| EXTRA_SHEET | Glossary | The brief lists 12 sheets but the workbook has 13. Preserve and require Glossary too. |
| WORKED_TOTAL | Worked Example!B5:B25, C27, A35 | Line items sum to $1,428, matching C27. A35 says $1,342. Preserve both; Phase 3's golden check must reject this disagreement until the source is corrected. |
| WORKED_COUNTS | Worked Example!B30, A35 | Table and individual rows show two can't-measure items; prose says three. There is a separate Protected Oura source. Do not silently count it as can't-measure. |
| WORKED_ORDER | Worked Example!F21:F24; Start Here!B36 | Example orders coffee first, while descending expected effect puts alcohol first. Phase 3 needs a decision about the example's order. The 10 drops and $767 back do reconcile. |
| COLUMN_CONFLICTS | Items!AC versus AG and AD/AF | Many AC cells describe conditional rules while AG says “Routes on the item name alone.” Examples: premium/boutique gym visits, recovery studio usage, vitamin C serum oxidation, collagen gummies, eye-cream ingredients and unused subscriptions. Phase 1 transcribes AG and preserves all AC text. Phase 3 cannot pass the worked example from AG alone; the team needs to reconcile the source. |
| DOSE_COLUMNS | Items!X versus AG | Some “lowest dose” values differ from the tier-flip thresholds, e.g. L-theanine 200 mg versus 100 mg, glycine 3 g versus 1 g. The brief specifically requests AG rule translation, so code follows AG and retains X. Confirm these distinctions. |
| SAFETY_PRECEDENCE | B12 rule; kava rule; Start Here!B32 | B12's local rule says doctor-sourced → T3, but global rules require Protected. Kava with a liver condition has a similar conflict. Global Protected precedence wins, with no opinion or cost in the output. |
| THRESHOLD_CHIPS | Follow-up Questions and individual AG cells | `1 to 3` visits spans sauna's `<2` threshold. The `1 to 3 months ago` chip spans an exact `>30 days` boundary. Request an exact count/date where needed; never use a midpoint. UI wording needs reconciliation in Phase 8. |
| B12_AGE_60 | Items!AC25/AG25/AJ25 | “60+”, “over 60” and “under 60” leave the exact age-60 case inconsistent. Conservative T3 pending clarification. |
| DINNER_90_MINUTES | Items!AG85 | “within 90 min” and “90 min to 3 h” overlap at 90. Conservative T3 at exactly 90; the surrounding branches remain explicit. |
| BATHROOM_THREE_NIGHTS | Items!AF89/AG89 | Chips say `3+`, rule says “most nights.” Three nights stays T3 with a team-question flag; a known majority (4–7) follows the rule. |
| PHONE_THREE_TO_FIVE_NIGHTS | Items!AF110/AG110 | Chips include 3–5 but the rule names only “rarely” and “most.” The middle band stays T3 pending a rule. |
| WAKE_SPREAD_30_TO_60 | Items!AG113 | Rule defines `<30` and `>60`; 30–60 inclusive is undefined. Conservative T3. |
| FRACTIONAL_COFFEE | Items!AG80 | 1, 2 and 3+ cups are covered; fractional cups between 2 and 3 are not. Conservative T3. |
| RED_LIGHT_GOALS | Items!J130, P130, Y130, AC130, AG130 | Goal text suggests a sleep experiment despite no visible metric/effect, and a testosterone drop despite grade C. Preserve text; unresolved goals remain T3. |
| ACUPUNCTURE_GOAL | Items!AC152/AG152 and global clinical-service protection | Goal-dependent behavior and the clinical-service boundary need reconciliation. No visit in 90 days excludes the item; otherwise conservative T3 until marked clinical/diagnosed, which is Protected. |
| RATING_GOALS | Items!AG150; Goal to Number | Massage requests a stress rating, while the goal map associates recovery/stress with HRV and no daily rating. Phase 1 retains the stress hint; Phase 3 must reconcile it before offering a rating. |
| SOURCE_COPY | Items!AJ; Verdict Templates examples; Tone Guide | Some raw day-one text exceeds 60 words, uses banned words, states unverified effects, or speaks about sample usage as if observed. The Protected template also contains two sentences despite the one-sentence rule. Ingestion preserves source; user-facing rendering requires review and final tone checks in Phase 7. |

## Questions retained from the supplied brief

- Who signs off on the 93 fact-check rows, and may an unverified T2 drop be shown before sign-off? The flag is preserved; this phase creates no new advice UI.
- What pricing, if any, will exist? Billing and related app copy are outside this implementation.
- When is a native iOS companion planned to replace Apple export uploads?
- Is Fitbit API access confirmed for the launch window? Phase 2 must verify current provider documentation.
- Who owns revisions to literature effect estimates once real data accumulates?

## Later algorithm decisions already visible in the brief

- `[3,3,3,3,2]` cannot be assigned into equal seven-night sides: no subset sums to seven. Phase 4 must select a feasible layout and validate balance rather than use the example uncritically.
- A one-sided test pre-registered in the beneficial direction cannot also declare an opposite-direction drop at the same tail's alpha. Phase 5 needs an explicit decision table and a coherent testing design before simulation claims.
- Removing the first night from each of five blocks leaves nine valid nights, below the required five per side. Carryover rules, minimum data and the schedule must be designed together.
- The brief's “Phase 1–5 done” acceptance references simulation from Phase 6. Overall algorithm acceptance therefore remains pending Phase 6; Phase 1 does not claim it.

## Phase 8 (web app) questions, 2026-10-02

Raised while turning the Figma prototype into the screens in [ONBOARDING.md](ONBOARDING.md). The app follows the handling in the third column until the team decides.

| ID | Source | Issue and current handling |
| --- | --- | --- |
| GUARANTEE_COPY | Prototype screen 9; `public/index.html` offer section | The prototype promises "in 60 days, at least five things lighter"; the landing page promises "pay nothing unless something measurably moves." They are different guarantees. Neither appears in the app (SPEC section 10). The team picks one for the site. |
| EMAIL_TEMPLATE_PATH | DATA_SOURCES.md step 5; Phase 8 sign-in | Phase 2 points the Supabase magic-link template at `/api/auth/confirm`, which returns a JSON session for API clients. The browser app needs `/auth/callback`, which sets the cookie session. One project has one email template. Phase 8 uses `/auth/callback`; decide whether the API path keeps its own template or reads the same `token_hash`. |
| WEARABLE_SUBSCRIPTION_ROW | Worked Example!A25 | The example lists "Oura ring, $6, Protected (it's the data source)". No catalog row covers a single wearable subscription (only "Second wearable"). The app adds the connected wearable's subscription as a Protected line with an editable cost and no catalog key. Confirm, or add a row. |
| ALIASES | SPEC 11.2; Items!B | SPEC asks for fuzzy matching on "name and aliases". The catalog has no aliases column. The app derives aliases from the parenthetical and slash-separated parts of each name (so "AG1", "Equinox", "Calm", "Peloton" resolve) plus a short hand-written list in `apps/web/lib/search/aliases.ts`. An Aliases column in the workbook would move this into the source. |
| DAY_ONE_SAMPLE_NUMBERS | Items!AJ for premium gym, fitness app, massage membership | The day-one sentences carry sample numbers ("You went 3 times last month. That's $83 a visit", "Last opened six weeks ago", "last visit was in July") that contradict the Worked Example's tapped answers (11 visits, 9 uses). The app shows the sentences word for word and marks them in the fixture. Phase 7 templates them, or the sheet drops the numbers. Two demo rows also fail `toneLint` as written: magnesium (61 words) and the meditation app (third person). |
| ZERO_COST_DROPPED | Verdict Templates!B3 and its example | The "Tier 1, dropped" template ends "Dropped, and {cost} a month back." Four of the Worked Example's testable items cost $0. The template's own example (training after 7pm) omits the clause. The Phase 8 fixture omits it at $0. Phase 7 confirms the rule. |
| EFFORT_MONTHS | Verdict Templates {months}; Tone Guide row 4 | Verdicts open with the effort ("Eight months in"). Onboarding does not collect how long an item has been in the stack. The app asks once, on the day-one screen, when the first experiment starts (a number box, months, "Not sure" allowed). Decide where this belongs and what the sentence does with "Not sure". |
| INSTRUCTION_LINES | Today screen; no workbook column | The daily line ("Today: no coffee after 2pm" / "Today: coffee as usual") has no source in the workbook. The demo fixture carries two lines per testable item, lint-checked. Phase 4 or a new column owns them. |
| GOAL_PER_ITEM | Start Here!B34; SPEC 6 step 3 | Routing checks a goal per item. The app asks one multi-select "What are you hoping to change?" and a per-item goal only where the item's rule reads `goal`. Phase 3 decides how the overall goals feed step 3 for items that were never asked. |
| DISCLAIMER_WORDING | SPEC non-negotiable 1; `public/index.html` footer | The site's disclaimer says "does not diagnose, treat or prevent any condition", and "treat" and "prevent" are on the banned list, so `toneLint` rejects it. The app's footer reads "It is not a medical product and nothing here is medical advice." Legal or the team confirms the wording that goes in the app. |
| WORKED_TOTAL (note) | Worked Example!C27, A35 | Arithmetic, not a decision: $1,428 less the drinks ($80) and the Oura ring ($6) is $1,342, so the prose total seems to leave out the behaviour that carries a cost and the Protected data source. The app's headline is the sum of every entered cost. Decide what the headline counts. |
| CHIP_TO_RULE_MAPPING | Items!AF; engine `RuleAnswers` | Chip text maps to typed answers item by item (omega-3 asks "mg per capsule" and "capsules a day" and the rule reads a daily total; coffee's chips are time bands; last-used chips straddle 30 days). The app parses `answerOptionsText` per trigger type, derives the daily dose by multiplication, and asks an exact number wherever `evaluateItemRule` reports the field as unanswered. A test covers all 210 rows. Rows whose text does not parse fall back to the generic wording from the Follow-up Questions sheet and are listed in the test output. |
| DELETE_PATH | DATA_SOURCES.md deletion; Settings | Until Phase 2 merges, "Delete everything" removes the Phase 8 rows and the auth user through a server action with the service-role key. After the merge it calls `DELETE /api/account`, which also clears Storage. One path survives; decide which. |
| MERGE_WITH_PHASE_2 | `origin/phase-2/data-sources`; `phase-8/web-ui` | Both branches create `apps/web` and edit the root `package.json`, `eslint.config.js` and `.gitignore`. Phase 8 copies Phase 2's versions of the shared files and only adds to them, so the merge should conflict only on `pnpm-lock.yaml`, which is regenerated with `pnpm install`. Merge order is the team's call. |
