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

- Phase 2 verification (2026-10-02): Google says the legacy Fitbit API shuts down October 30, 2026, and its replacement is not onboarding new projects. Who owns obtaining Google Health API access? Fitbit legacy support is gated off by default; see [DATA_SOURCES.md](DATA_SOURCES.md).
- Phase 2 deployment: which Supabase/Vercel projects and approved Oura/WHOOP test clients should be used for live acceptance? Implementation and local tests cannot establish access to external accounts.
- Phase 2 Apple import: confirm the 90-minute session-gap convention and explicit source selection against representative exports; no sleep latency or temperature deviation is inferred from unsupported fields.

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
