# Golden set coverage

Forty people, each counted on the dimensions in its `covers` tags (regenerate with `python3 src/coverage.py`).
Columns: 1-4 / 5-9 / 10+ = stack size; none / oura / whoop = wearable; goal = hard goal; loved / unloved = vice;
clin = clinician item; borr = borrowed noise; A-unfelt = tier A item done but unfelt; busy / travel / unwell = season;
skin+ = doing too much on skin; derm = skin concern for a dermatologist.

| # | id | by | items | 1-4 | 5-9 | 10+ | none | oura | whoop | goal | loved | unloved | clin | borr | A-unfelt | busy | travel | unwell | skin+ | derm |
|---:|---|---|---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | maya-29 | example | 3 | x |  |  |  | x |  |  |  |  |  | x |  |  |  |  |  |  |
| 2 | jake-34 | example | 3 | x |  |  |  | x |  |  | x |  |  |  | x | x |  |  |  |  |
| 3 | priya-41 | example | 3 | x |  |  | x |  |  | x |  |  |  |  |  |  |  | x |  |  |
| 4 | daniel-26 | example | 3 | x |  |  |  |  | x |  |  |  |  |  | x |  | x |  |  |  |
| 5 | elena-52 | example | 2 | x |  |  | x |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 6 | chris-31 | example | 1 | x |  |  |  |  | x |  |  |  |  |  |  |  | x |  |  |  |
| 7 | sofia-23 | example | 2 | x |  |  | x |  |  |  |  |  |  | x |  |  | x |  | x |  |
| 8 | marcus-38 | example | 2 | x |  |  |  |  | x |  |  |  |  |  |  | x |  |  |  |  |
| 9 | tomas-33 | Claude | 11 |  |  | x |  |  | x | x | x |  |  | x | x | x |  |  |  |  |
| 10 | kenji-26 | Claude | 7 |  | x |  | x |  |  | x |  | x | x | x |  | x |  |  |  |  |
| 11 | ravi-31 | Claude | 11 |  |  | x |  | x |  |  |  |  |  | x | x |  | x |  |  |  |
| 12 | grace-34 | Claude | 8 |  | x |  |  | x |  |  |  |  | x | x |  |  |  | x |  |  |
| 13 | zoe-24 | Claude | 7 |  | x |  | x |  |  |  |  |  |  | x |  |  |  |  | x | x |
| 14 | owen-41 | Claude | 7 |  | x |  |  |  | x |  |  |  | x |  |  |  |  |  |  | x |
| 15 | matteo-36 | Claude | 7 |  | x |  |  |  | x |  | x |  |  | x | x |  |  |  |  |  |
| 16 | simone-38 | Claude | 6 |  | x |  |  | x |  |  |  | x | x | x |  |  |  |  |  |  |
| 17 | devon-29 | Claude | 7 |  | x |  |  |  | x |  |  | x |  |  |  | x |  |  |  |  |
| 18 | hana-25 | Claude | 7 |  | x |  |  | x |  |  |  | x |  | x |  |  | x |  |  |  |
| 19 | linda-44 | Claude | 11 |  |  | x | x |  |  |  |  |  | x | x |  | x |  |  |  |  |
| 20 | jordan-28 | Claude | 11 |  |  | x |  |  | x | x |  |  |  | x | x |  |  |  | x |  |
| 21 | claire-35 | Claude | 7 |  | x |  |  | x |  |  | x |  |  |  | x |  | x |  |  |  |
| 22 | eli-42 | Claude | 3 | x |  |  | x |  |  |  |  |  |  |  |  | x |  |  |  |  |
| 23 | ethan-24 | Claude | 7 |  | x |  |  |  | x |  |  |  |  | x | x |  |  | x |  |  |
| 24 | naomi-30 | Claude | 8 |  | x |  |  | x |  |  |  |  | x | x | x | x |  |  | x |  |
| 25 | tess-37 | Claude | 11 |  |  | x |  | x |  |  |  |  |  | x |  |  |  | x | x |  |
| 26 | amara-32 | Claude | 7 |  | x |  |  |  | x | x |  |  |  | x |  |  |  |  |  |  |
| 27 | fatima-27 | Claude | 3 | x |  |  | x |  |  | x |  | x |  | x |  |  |  | x |  |  |
| 28 | valeria-39 | Claude | 11 |  |  | x |  | x |  |  | x |  | x | x |  |  | x |  |  |  |
| 29 | brandon-45 | Claude | 11 |  |  | x |  |  | x | x |  | x | x | x |  | x |  |  |  |  |
| 30 | mei-29 | Claude | 11 |  |  | x | x |  |  |  |  |  |  | x | x |  |  |  | x |  |
| 31 | andre-40 | Claude | 4 | x |  |  | x |  |  | x | x |  | x |  |  |  |  | x |  |  |
| 32 | ingrid-43 | Claude | 11 |  |  | x |  | x |  |  |  |  | x | x | x |  |  | x |  |  |
| 33 | diego-27 | Claude | 4 | x |  |  |  |  | x |  | x |  |  | x |  |  |  |  |  |  |
| 34 | becca-30 | Claude | 11 |  |  | x |  |  | x | x |  |  |  | x | x |  |  |  |  |  |
| 35 | nora-22 | Claude | 4 | x |  |  | x |  |  |  |  | x |  | x |  |  | x |  |  |  |
| 36 | omar-33 | Claude | 12 |  |  | x |  | x |  |  |  |  | x | x |  |  |  |  |  |  |
| 37 | luca-26 | Claude | 7 |  | x |  | x |  |  |  | x |  |  | x |  | x |  |  | x |  |
| 38 | joanna-42 | Claude | 11 |  |  | x |  | x |  |  | x |  |  | x |  | x |  | x |  |  |
| 39 | britt-27 | Claude | 11 |  |  | x | x |  |  |  | x |  |  | x |  |  |  |  |  |  |
| 40 | aaron-39 | Claude | 7 |  | x |  | x |  |  |  |  |  | x | x |  | x |  |  |  |  |
| | **Total** | | | **13** | **14** | **13** | **14** | **13** | **13** | **9** | **10** | **7** | **12** | **29** | **12** | **12** | **8** | **8** | **7** | **2** |
| | Minimum | | | 10 | 10 | 10 | 10 | 10 | 10 | 8 | 6 | 6 | 6 | 12 | 8 | 4 | 4 | 4 | 6 | 2 |
| | Met | | | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes | yes |

## Who they are

1. `maya-29` (example): SF; Saturday reformer with Leah is hers, AG1 bought out of TikTok guilt
2. `jake-34` (example): NYC; Wine Fridays with Sam, unfelt creatine, Equinox for the sauna; launch week
3. `priya-41` (example): Bay Area mom; bath and Sunday call with Amma; unused Peloton; half marathon with her sister
4. `daniel-26` (example): Chicago, terse; Tue/Thu pickup with the same crew; Vegas weekend
5. `elena-52` (example): Swims since her mother died; tea with Rosa; Calm twice a month; gentleness test
6. `chris-31` (example): Denver; one daily cold plunge and a prompt-injection note; Austin trip
7. `sofia-23` (example): Student; café window seat and journal; TikTok 10-step routine; Puebla trip
8. `marcus-38` (example): Golf with his dad and brother every other Saturday; Whoop; quarter-end crunch
9. `tomas-33` (Claude): Brooklyn ER nurse running the NYC marathon Nov 1; run club and post-run beers
10. `kenji-26` (Claude): Med student before Step 2; Zyn and energy drinks; Vyvanse; bouldering with Theo
11. `ravi-31` (Claude): SF engineer; Oura plus WHOOP, CGM he stopped wearing; climbing with Jess; NY trip
12. `grace-34` (Claude): Oakland, four months postpartum; OB and bloodwork items; Instagram hair products; colds
13. `zoe-24` (Claude): Astoria; two years of painful breakouts, TikTok retinoid plus acids; dermatologist case
14. `owen-41` (Claude): Berkeley teacher and cyclist; a mole that changed; PT; dermatologist case
15. `matteo-36` (Claude): Jersey City; Sunday cigar on Pop's porch; podcast T booster; dad in hospital
16. `simone-38` (Claude): Seattle, shared custody; wine alone most nights, asks for help; choir; sertraline
17. `devon-29` (Claude): NYC banker; a can of Zyn a day; Sunday soccer at Pier 40; signing week
18. `hana-25` (Claude): Austin; phone in bed till 1, TikTok sleep fixes, two apps; two-stepping; sister's wedding
19. `linda-44` (Claude): San Jose vice principal; four clinician items, ad-bought joint stuff; mahjong; conferences
20. `jordan-28` (Claude): LA, wedding in June; trainer Dani; fat burner and berberine; retinol plus acid
21. `claire-35` (Claude): Manhattan consultant flying weekly; Friday negronis with Dee; crossword with Dad
22. `eli-42` (Claude): Brooklyn carpenter; walk with his old dog June, therapy; nothing to clear
23. `ethan-24` (Claude): SF analyst; 'can I stop the creatine?'; BCAAs; Sunday dinner in San Jose; flu
24. `naomi-30` (Claude): Boston ICU nurse; tretinoin plus a TikTok acid same nights; breakfast with Carmen
25. `tess-37` (Claude): SF sales director; facial plus LED plus microcurrent; two studios; sailing with Dad
26. `amara-32` (Claude): Atlanta; Hyrox doubles in December; F45 crew; cryo and doubled electrolytes
27. `fatima-27` (Claude): PhD student before quals; lion's mane, phone in bed; lab badminton; stomach flu
28. `valeria-39` (Claude): Chicago chef; five sleep aids; Sunday mezcal with her crew; inositol; Oaxaca
29. `brandon-45` (Claude): Burlingame VP; half Ironman; TRT clinic; studio plus own tub; Slack in bed
30. `mei-29` (Claude): East Village; eleven-step routine, two exfoliants; sheet masks with her sister Lin
31. `andre-40` (Claude): Philly coach; Eagles Sundays with Dad; lisinopril; Broad Street Run; stomach bug
32. `ingrid-43` (Claude): Minneapolis, perimenopause; progesterone; podcast herbs; sauna with sisters; covid
33. `diego-27` (Claude): Mission barista; Wednesday league and tacos; afternoon cupping; abuela visits
34. `becca-30` (Claude): Denver vet tech; first powerlifting meet; gym-floor extras; burritos with the club
35. `nora-22` (Claude): Greenpoint, first job; vape all day, asks for help; sea moss; FaceTime with Jo
36. `omar-33` (Claude): Fremont; CBT-I coach plus a podcast sleep stack and score checking; cricket
37. `luca-26` (Claude): Bushwick bartender; daily scrub plus acid; shift beer with the crew; Halloween doubles
38. `joanna-42` (Claude): UWS litigator; IV drips, hyperbaric, NAD+; martini with Ben; strep, then trial
39. `britt-27` (Claude): Phoenix; TikTok Shop stack, salt lamp she likes; trivia; hikes with her mom
40. `aaron-39` (Claude): Rockaway bus mechanic; CPAP plus TikTok mouth tape; fishing with Eddie; overtime
