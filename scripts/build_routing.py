"""Build public/routing.json from docs/Routing-Table.xlsx.

Run from the repo root:  python3 scripts/build_routing.py
Needs: pip install openpyxl

The spreadsheet is the source of truth for every item. This script trims it to
the fields the website widget needs and adds the follow-up-question rules as
data the browser can run (the sheet writes those rules as prose).
"""
import json, re, sys
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "docs" / "Routing-Table.xlsx"
OUT = ROOT / "public" / "routing.json"

wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
rows = list(wb["Items"].iter_rows(values_only=True))
hdr = rows[0]
raw = [dict(zip(hdr, r)) for r in rows[1:] if r[1]]

def s(v):
    return None if v is None else str(v).strip()

def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

items = []
by_key = {}
for r in raw:
    it = {
        "k": s(r["Key"]),
        "n": s(r["Item"]),
        "kind": s(r["Do, buy, or environment"]),
        "cat": s(r["Category"]),
        "cost": num(r["Cost per month (USD)"]) or 0,
        "amt": s(r["Typical amount or how often"]),
        "for": s(r["What people usually take it for"]),
        "see": s(r["Can a wearable see it?"]),
        "num": s(r["Which number we'd watch"]),
        "speed": (s(r["How fast it acts and clears"]) or "").split(":")[0],
        "how": s(r["How we'd test it"]),
        "effect": num(r["Expected effect (in units of a normal night-to-night swing)"]),
        "chance": s(r["Chance of a clear answer in two weeks"]),
        "tier": s(r["Tier"]),
        "tname": s(r["Tier name"]),
        "etier": s(r["Tier after the effect gate (what the engine uses)"]),
        "hist": s(r["Can we read it from their history?"]),
        "assign": s(r["On-days: assigned or observed?"]),
        "grade": s(r["Evidence grade"]),
        "found": s(r["What the studies actually found"]),
        "why2": s(r["Why it's a day-one drop (Tier 2 only)"]),
        "goalnote": s(r["How the answer changes with the person's goal or situation"]),
        "safety": s(r["Safety note (shown with the verdict)"]),
        "day1": s(r["What the user reads on day one"]),
        "fc": s(r["Needs a fact-check?"]) == "yes",
    }
    items.append(it)
    by_key[it["k"]] = it

# ---------------------------------------------------------------------------
# Follow-up questions, written as data. Each rule is a list of questions.
# An option can carry: bad (form not absorbed), tier2 (reason, detail),
# none (not a hypothesis, text), effect (override), number (override),
# note, keep, safety. A number question carries floor rules.
# ---------------------------------------------------------------------------
LAST_USED = {"id": "used", "q": "When did you last use it?",
             "options": [{"label": "This week"}, {"label": "This month"},
                         {"label": "1 to 3 months ago", "tier2": "not being used", "detail": "last used one to three months ago"},
                         {"label": "Longer", "tier2": "not being used", "detail": "last used months ago"},
                         {"label": "Can't remember", "tier2": "not being used", "detail": "you can't remember the last time you used it"}],
             "default": "This week"}
VISITS = lambda zero_detail, low=None: {"id": "visits", "q": "How many visits in the last 30 days?",
             "options": [{"label": "0", "tier2": "not being used", "detail": zero_detail},
                         dict({"label": "1 to 3"}, **(low or {})), {"label": "4 to 7"}, {"label": "8 or more", "keep": True}],
             "default": "4 to 7"}
def dose(q, unit, floor, floor_text, default, **extra):
    d = {"id": "dose", "q": q, "number": True, "unit": unit, "floor": floor, "floorText": floor_text, "default": default}
    d.update(extra); return d
def forms(labels, default, bad=(), q="Which form?"):
    return {"id": "form", "q": q, "options": [dict({"label": l}, **({"bad": "form not absorbed"} if l in bad else {})) for l in labels], "default": default}

RULES = {
 "magnesium-any-form": [forms(["glycinate","citrate","malate","threonate","oxide","spray or oil","not sure"], "glycinate", bad=("oxide","spray or oil")),
                        dose("How much a day?", "mg elemental", 200, "200 mg elemental (the sleep trials used 320 to 500 mg)", 400)],
 "magnesium-l-threonate": [dose("How much a day?", "g of product", 1, "1 g of product a day", 2)],
 "melatonin": [{"id":"dose","q":"How much a night?","options":[{"label":"0.3 mg"},{"label":"0.5 mg"},{"label":"1 mg"},
                {"label":"3 mg","note":"Less is more with melatonin: 0.3 to 1 mg did as well as higher doses in the trials, and it's cheaper."},
                {"label":"5 mg","note":"Less is more with melatonin: 0.3 to 1 mg did as well as higher doses in the trials, and it's cheaper."},
                {"label":"10 mg","note":"Less is more with melatonin: 0.3 to 1 mg did as well as higher doses in the trials.","safety":"At 10 mg, next-morning grogginess is common. Ask a clinician if you're on other medication."}],"default":"3 mg"}],
 "l-theanine": [dose("How much a day?", "mg", 100, "100 mg (most sleep trials used 200 mg)", 200)],
 "glycine": [dose("How much a night?", "g", 1, "1 g (the trials used 3 g)", 3)],
 "ashwagandha-ksm-66-sensoril": [forms(["KSM-66","Sensoril","other extract","plain root powder","not sure"], "KSM-66"),
                        dose("How much a day?", "mg", 250, "250 mg of a standardised extract (or 1 g of plain root powder)", 600, formFloors={"plain root powder": 1000})],
 "valerian": [dose("How much a night?", "mg", 300, "300 mg", 450)],
 "tart-cherry-juice-extract": [forms(["juice","extract"], "juice"),
                        dose("How much a day?", "ml of juice, or mg of extract", 240, "240 ml of juice or 480 mg of extract a day", 240, formFloors={"extract": 480})],
 "cbd": [dose("How much per serving?", "mg", 25, "25 mg (the trials used 25 to 160 mg and more)", 25)],
 "5-htp": [dose("How much a day?", "mg", 100, "100 mg", 100)],
 "lavender-oil-oral-silexan": [forms(["Silexan 80 mg","other oral lavender","essential oil by mouth"], "Silexan 80 mg", bad=("other oral lavender","essential oil by mouth"))],
 "sleep-gummies-blend": [{"id":"dose","q":"Melatonin per gummy, from the label?","options":[{"label":"none"},{"label":"1 mg"},{"label":"3 mg"},
                {"label":"5 mg","note":"Plain melatonin at 0.5 mg does the same job for about a third of the price."},
                {"label":"10 mg","note":"Plain melatonin at 0.5 mg does the same job for about a third of the price."}],"default":"5 mg"}],
 "vitamin-d3": [dose("How much a day?", "IU", 0, "", 2000, safetyOver=10000, safetyText="Over 10,000 IU a day is more than the safety reviews cover. Ask a clinician, and get a blood level.")],
 "omega-3-fish-oil": [dose("EPA plus DHA a day, from the back of the bottle?", "mg", 500, "500 mg of EPA and DHA a day (the trials used 1 g or more)", 300, soft=1000, softText="Between 500 mg and 1 g you're below the studied dose. Two capsules would get you there.")],
 "krill-oil": [dose("EPA plus DHA a day, from the back of the bottle?", "mg", 1000, "1 g of EPA and DHA a day", 300)],
 "creatine-monohydrate": [{"id":"form","q":"Which form?","options":[{"label":"monohydrate"},{"label":"HCl","note":"Monohydrate is the studied form. The others cost more and have less behind them."},{"label":"buffered","note":"Monohydrate is the studied form. The others cost more and have less behind them."},{"label":"blend","note":"Monohydrate is the studied form. The others cost more and have less behind them."}],"default":"monohydrate"},
                        dose("How much a day?", "g", 2, "2 g a day (3 to 5 g is standard)", 5)],
 "beta-alanine": [dose("How much a day?", "g", 2, "2 g a day", 3.2)],
 "collagen-peptides": [dose("How much a day?", "g", 5, "5 g a day (the trials used 10 g; a scoop is usually 10 g)", 10, soft=10, softText="Between 5 and 10 g you're below the studied dose.")],
 "hyaluronic-acid-oral": [dose("How much a day?", "mg", 120, "120 mg a day", 120)],
 "turmeric-curcumin": [forms(["plain turmeric","curcumin with piperine","phytosome / Meriva","other"], "curcumin with piperine", bad=("plain turmeric",))],
 "glucosamine-chondroitin": [dose("How much a day?", "mg", 1000, "1,000 mg a day", 1500)],
 "rhodiola": [dose("How much a day?", "mg", 200, "200 mg a day", 400)],
 "saffron": [dose("How much a day?", "mg", 30, "30 mg a day", 30)],
 "zinc-daily": [{"id":"form","q":"How do you take it?","options":[{"label":"every day"},{"label":"lozenges only when a cold starts","keep":True,"note":"Lozenges at the first sign of a cold are the one use with decent evidence. Keep those."}],"default":"every day"},
                dose("How much a day?", "mg", 0, "", 15, safetyOver=40, safetyText="Over 40 mg a day for months can push copper down. Ask a clinician.")],
 "probiotic-generic-daily": [{"id":"form","q":"Which kind?","options":[{"label":"a named strain for a named problem","keep":True,"note":"A named strain for the problem it was studied for is the one case with real evidence. Keep."},{"label":"a generic blend"},{"label":"not sure"}],"default":"a generic blend"}],
 "berberine": [dose("How much a day, all doses added up?", "mg", 1000, "1 g a day", 1000)],
 # clock time
 "coffee-after-2pm": [{"id":"time","q":"When is your last coffee, usually?","options":[
        {"label":"before noon","none":"Before noon, the caffeine is long gone by bedtime. Not a hypothesis for you; nothing to test and nothing to drop."},
        {"label":"12 to 2pm","effect":0.6},{"label":"2 to 5pm","effect":1.0},{"label":"after 5pm","effect":1.2}],"default":"2 to 5pm"}],
 "energy-drinks": [{"id":"time","q":"When, usually?","options":[{"label":"before noon","effect":0.7},{"label":"12 to 2pm","effect":0.7},{"label":"after 2pm","effect":1.0}],"default":"after 2pm"}],
 "matcha-green-tea-in-the-afternoon": [{"id":"time","q":"When, usually?","options":[{"label":"before 2pm","none":"Before 2pm the caffeine has cleared by bedtime. Not a hypothesis for you."},{"label":"after 2pm","effect":0.4}],"default":"after 2pm"}],
 "late-dinner-within-2-3-h-of-bed": [{"id":"time","q":"Hours between dinner and bed, usually?","options":[{"label":"under 1.5","effect":0.8},{"label":"1.5 to 3","effect":0.5},{"label":"over 3","none":"With three hours or more between dinner and bed, this isn't a hypothesis for you."}],"default":"1.5 to 3"}],
 "nicotine-pouches-vape": [{"id":"time","q":"When do you use it?","options":[{"label":"daytime only","none":"Daytime-only use isn't a sleep hypothesis. Nothing to test here."},{"label":"some after 6pm","effect":0.9},{"label":"mostly evening","effect":0.9}],"default":"some after 6pm"}],
 "training-after-7pm": [{"id":"time","q":"In the app this is read from your workouts. For now: how late and how hard?","options":[{"label":"hard, ends within 2 h of bed","effect":1.0},{"label":"hard, ends before 8pm","effect":0.4},{"label":"easy session","effect":0.4}],"default":"hard, ends within 2 h of bed"}],
 "hiit-in-the-evening": [{"id":"time","q":"In the app this is read from your workouts. For now: when does it end?","options":[{"label":"within 2 h of bed","effect":1.0},{"label":"earlier than that","none":"Intervals that end more than two hours before bed have cleared by the time you sleep. Not a hypothesis for you."}],"default":"within 2 h of bed"}],
 "cold-plunge-ice-bath": [{"id":"time","q":"Morning or evening?","options":[{"label":"morning","number":"Overnight HRV","effect":0.5},{"label":"evening","number":"Time to fall asleep","effect":0.5}],"default":"evening"}],
 "sauna-post-workout-or-evening": [{"id":"time","q":"When, usually?","options":[{"label":"morning","number":"Overnight HRV","effect":0.5},{"label":"midday","number":"Overnight HRV","effect":0.5},{"label":"evening","number":"Time to fall asleep","effect":0.9}],"default":"evening"}],
 "afternoon-nap-after-3pm-or-over-30-min": [{"id":"time","q":"In the app this is read from your wearable. For now: how often?","options":[{"label":"3 or more days a week","effect":0.8},{"label":"less than that","none":"An occasional short nap isn't a hypothesis for you."}],"default":"3 or more days a week"}],
 "bedroom-temperature-thermostat": [{"id":"time","q":"Room over 21°C, or do you wake hot?","options":[{"label":"yes","effect":1.0},{"label":"no","effect":0.7}],"default":"no"}],
 # frequency
 "electrolytes-lmnt-etc": [{"id":"freq","q":"How much do you train?","options":[{"label":"over an hour most days, or keto","keep":True,"note":"Long sessions or a keto diet are the two cases where electrolytes earn their place. Keep."},{"label":"less than that","note":"For sessions under an hour, water and food replace what you lose. That's what the studies found."}],"default":"less than that"}],
 "second-or-third-coffee": [{"id":"freq","q":"Cups a day?","options":[{"label":"1","none":"One cup isn't a hypothesis for the second-cup question."},{"label":"2","effect":0.4},{"label":"3","effect":0.8},{"label":"4 or more","effect":0.8}],"default":"2"}],
 "fluids-after-8pm": [{"id":"freq","q":"Bathroom wake-ups a week?","options":[{"label":"0","effect":0.6},{"label":"1 to 2","effect":0.6},{"label":"3 or more","effect":1.0}],"default":"1 to 2"}],
 "screens-phone-in-bed": [{"id":"freq","q":"Nights a week with the phone in bed?","options":[{"label":"0 to 2","none":"A couple of nights a week isn't enough on-nights to test, and probably isn't a problem."},{"label":"3 to 5","effect":0.9},{"label":"most","effect":0.9}],"default":"most"}],
 "sauna-bathhouse-membership": [VISITS("no visits last month while still paying", low={"note":"At one to three visits a month, that's what each visit costs. Worth knowing."})],
 "cryotherapy-sessions": [VISITS("no visits in the last two months, with sessions still banked")],
 "massage-monthly": [VISITS("credits banked and unused for two months")],
 "facials-monthly": [VISITS("no visit in three months while still paying")],
 "acupuncture": [VISITS("no visit in three months")],
 "chiropractor-maintenance-visits": [{"id":"freq","q":"Current pain?","options":[{"label":"yes"},{"label":"no","note":"Maintenance visits with no current pain have no evidence behind them. With pain, a pain rating is the honest test."}],"default":"no"}],
 "personal-trainer": [{"id":"visits","q":"Sessions in the last 30 days?","options":[{"label":"0","note":"Fewer than two sessions a month: not a drop, but the point of a trainer is going. That's the cost per session you're paying."},{"label":"1 to 3","note":"Fewer than two sessions a month: not a drop, but the point of a trainer is going. That's the cost per session you're paying."},{"label":"4 to 7","keep":True},{"label":"8 or more","keep":True}],"default":"4 to 7"}],
 "gym-membership": [{"id":"visits","q":"Visits in the last 30 days?","options":[{"label":"0","tier2":"not being used","detail":"under four visits a month for two months running"},{"label":"1 to 3","tier2":"not being used","detail":"under four visits a month for two months running"},{"label":"4 to 7","note":"Four to seven visits: that's what each visit costs. Worth knowing, not a drop."},{"label":"8 or more","keep":True}],"default":"8 or more"}],
 "yoga-pilates-studio": [{"id":"visits","q":"Visits in the last 30 days?","options":[{"label":"0","tier2":"not being used","detail":"under four visits a month for two months running"},{"label":"1 to 3","tier2":"not being used","detail":"under four visits a month for two months running"},{"label":"4 to 7","keep":True},{"label":"8 or more","keep":True}],"default":"4 to 7"}],
 "float-tank": [VISITS("a package unused for two months")],
 "stretch-studio-assisted-stretching": [VISITS("under two visits a month while still paying")],
 # nights a week
 "alcohol-in-the-evening": [{"id":"nights","q":"Nights a week, usually?","options":[{"label":"0","none":"Nothing to test: it isn't in your inventory."},{"label":"1 to 2","note":"At one or two nights a week there are fewer on-nights, so this test runs over three to four weeks instead of two."},{"label":"3 to 4"},{"label":"5 or more"}],"default":"1 to 2"}],
 # last used
 "meditation-app-calm-headspace": [LAST_USED],
 "weighted-blanket": [LAST_USED],
 "mouth-tape": [LAST_USED, {"id":"snore","q":"Do you, or a partner, report snoring?","options":[{"label":"yes","effect":0.8,"safety":"Snoring with pauses in breathing needs a clinician before any taping. We'd check that first."},{"label":"no","effect":0.3},{"label":"not sure","effect":0.3}],"default":"no"}],
 "nasal-strips-dilator": [LAST_USED, {"id":"nose","q":"Blocked nose or snoring at night?","options":[{"label":"yes","effect":0.7},{"label":"no","effect":0.3}],"default":"no"}],
 "blue-light-blocking-glasses": [LAST_USED],
 "eye-mask": [LAST_USED],
 "earplugs": [LAST_USED, {"id":"noise","q":"Noisy room, or a snoring partner?","options":[{"label":"yes","effect":1.0},{"label":"no","effect":0.6}],"default":"no"}],
 "white-noise-sound-machine": [LAST_USED, {"id":"noise","q":"Is there noise to cover?","options":[{"label":"yes"},{"label":"no","note":"In a quiet room a sound machine can do the opposite of what you bought it for."}],"default":"yes"}],
 "sleep-headphones-sleep-stories": [LAST_USED],
 "sunrise-alarm-hatch-etc": [LAST_USED],
 "light-therapy-box-10-000-lux": [LAST_USED],
 "red-light-therapy-panel": [LAST_USED],
 "massage-gun": [LAST_USED],
 "compression-boots-normatec": [LAST_USED],
 "air-purifier-bedroom": [{"id":"used","q":"Is it running?","options":[{"label":"yes"},{"label":"off or unplugged for a month","tier2":"not being used","detail":"off or unplugged for a month"}],"default":"yes"},
                          {"id":"allergy","q":"Allergies, or heavy traffic outside?","options":[{"label":"yes","effect":0.7},{"label":"no","effect":0.3}],"default":"no"}],
 "humidifier": [LAST_USED],
 "vibration-plate": [LAST_USED],
 "led-face-mask": [LAST_USED],
 "cold-plunge-ice-bath-tub-owned": [LAST_USED],
 # still paying
 "greens-powder-ag1-etc": [{"id":"pay","q":"Still paying for it?","options":[{"label":"yes"},{"label":"no","none":"Not paying, not taking it: nothing to route."},{"label":"not sure","note":"Worth checking the subscription. It's about $90 a month."}],"default":"yes"}],
 "eight-sleep-cooling-mattress-pad": [{"id":"used","q":"Used the cooling in the last 30 days?","options":[{"label":"yes"},{"label":"no","tier2":"not being used","detail":"the subscription is active and the cooling hasn't been used in a month"}],"default":"yes"},
                                       {"id":"hot","q":"Do you sleep hot?","options":[{"label":"yes","effect":0.9},{"label":"no","effect":0.5}],"default":"no"}],
 "continuous-glucose-monitor-no-diabetes": [{"id":"pay","q":"Still paying for it?","options":[{"label":"yes"},{"label":"no","none":"Not paying, not wearing it: nothing to route."},{"label":"not sure","note":"Worth checking the subscription."}],"default":"yes"}],
}

missing = [k for k in RULES if k not in by_key]
if missing:
    print("RULE KEYS NOT IN SHEET:", missing); sys.exit(1)
for k, qs in RULES.items():
    by_key[k]["rule"] = qs

# ---------------------------------------------------------------------------
# Aliases: what people type -> key. Resolved by unique substring of key or name.
# ---------------------------------------------------------------------------
ALIASES = {
 "mag": "magnesium-any-form", "magnesium glycinate": "magnesium-any-form", "mag glycinate": "magnesium-any-form", "magnesium citrate": "magnesium-any-form", "magnesium oxide": "magnesium-any-form",
 "coffee": "coffee-after-2pm", "caffeine": "coffee-after-2pm", "espresso": "coffee-after-2pm", "latte": "coffee-after-2pm", "afternoon coffee": "coffee-after-2pm",
 "wine": "alcohol-in-the-evening", "beer": "alcohol-in-the-evening", "drinks": "alcohol-in-the-evening", "booze": "alcohol-in-the-evening", "cocktails": "alcohol-in-the-evening", "alcohol": "alcohol-in-the-evening", "nightcap": "alcohol-in-the-evening",
 "fish oil": "omega-3-fish-oil", "omega": "omega-3-fish-oil", "vitamin d": "vitamin-d3", "d3": "vitamin-d3",
 "phone in bed": "screens-phone-in-bed", "scrolling": "screens-phone-in-bed", "tiktok": "screens-phone-in-bed", "instagram": "screens-phone-in-bed", "screens": "screens-phone-in-bed",
 "ag1": "greens-powder-ag1-etc", "greens": "greens-powder-ag1-etc", "athletic greens": "greens-powder-ag1-etc",
 "calm": "meditation-app-calm-headspace", "headspace": "meditation-app-calm-headspace", "meditation": "meditation-app-calm-headspace",
 "equinox": "premium-gym", "lifetime": "premium-gym", "barrys": "boutique-class", "barry's": "boutique-class", "soulcycle": "boutique-class", "orangetheory": "boutique-class", "f45": "boutique-class",
 "peloton": "fitness-app", "ice bath": "cold-plunge-ice-bath", "cold plunge": "cold-plunge-ice-bath", "plunge": "cold-plunge-ice-bath",
 "hatch": "sunrise-alarm", "normatec": "compression-boots", "nuface": "microcurrent-device-nuface", "retinol": "retinol-retinoid-nightly", "tretinoin": "retinol-retinoid-nightly", "spf": "sunscreen",
 "melatonin gummies": "sleep-gummies-blend", "gummies": "sleep-gummies-blend", "weed": "thc-cannabis", "thc": "thc-cannabis", "edibles": "thc-cannabis", "cannabis": "thc-cannabis",
 "zyn": "nicotine", "vape": "nicotine", "nicotine": "nicotine", "sauna": "sauna-post-workout-or-evening", "eight sleep": "eight-sleep", "8 sleep": "eight-sleep",
 "cgm": "continuous-glucose", "levels": "continuous-glucose", "glucose monitor": "continuous-glucose", "lmnt": "electrolytes-lmnt", "electrolytes": "electrolytes-lmnt",
 "creatine": "creatine-monohydrate", "protein": "protein-powder", "whey": "protein-powder", "collagen": "collagen-peptides", "ashwagandha": "ashwagandha", "theanine": "l-theanine", "l theanine": "l-theanine",
 "nap": "afternoon-nap", "late dinner": "late-dinner", "eating late": "late-dinner", "evening workout": "training-after-7pm", "late gym": "training-after-7pm", "night workout": "training-after-7pm", "workout at night": "training-after-7pm",
 "hiit": "hiit-in-the-evening", "mouth taping": "mouth-tape", "blue light glasses": "blue-light-blocking", "weighted blanket": "weighted-blanket", "earplugs": "earplugs", "white noise": "white-noise",
 "multivitamin": "multivitamin", "multi": "multivitamin", "b12": "vitamin-b12", "zinc": "zinc-daily", "vitamin c": "vitamin-c-daily", "probiotic": "probiotic-generic", "turmeric": "turmeric", "curcumin": "turmeric",
 "krill": "krill-oil", "nmn": "nmn", "ginkgo": "ginkgo", "lions mane": "lion", "lion's mane": "lion", "apple cider vinegar": "apple-cider", "acv": "apple-cider",
 "fasting": "fasting-window", "intermittent fasting": "fasting-window", "cold shower": "cold-shower", "morning sun": "morning-sunlight", "sunlight": "morning-sunlight", "walk": "10-000-steps", "steps": "10-000-steps",
 "journaling": "journaling", "breathwork": "breathwork", "wim hof": "breathwork", "box breathing": "breathwork", "yoga before bed": "stretching-yoga", "stretching": "stretching-yoga",
 "massage": "massage-monthly", "chiro": "chiropractor", "chiropractor": "chiropractor", "acupuncture": "acupuncture", "facial": "facials", "red light": "red-light-therapy-panel", "led mask": "led-face-mask", "gua sha": "gua-sha",
 "toner": "toner", "eye cream": "eye-cream", "hyaluronic": "hyaluronic-acid-oral", "function health": "blood-panel", "blood test": "blood-panel", "trainer": "personal-trainer", "gym": "gym-membership", "pilates": "yoga-pilates", "yoga": "yoga-pilates",
 "float": "float-tank", "cryo": "cryotherapy", "stretch lab": "stretch-studio", "humidifier": "humidifier", "air purifier": "air-purifier", "thermostat": "bedroom-temperature", "room temperature": "bedroom-temperature", "ac at night": "bedroom-temperature",
 "blackout": "blackout", "fan": "window-open-fan", "dog in bed": "pet-in-the-bed", "cat in bed": "pet-in-the-bed", "pet": "pet-in-the-bed", "snooze": "snoozing", "pillow": "pillow", "mattress": "mattress-age-over-8-years",
 "dessert": "dessert-sugar", "sugar before bed": "dessert-sugar", "carbs at dinner": "big-carbohydrate", "decaf": "decaf-swap", "matcha": "matcha", "green tea": "matcha", "energy drink": "energy-drinks", "celsius": "energy-drinks", "red bull": "energy-drinks", "monster": "energy-drinks",
 "pre workout": "pre-workout", "preworkout": "pre-workout", "bcaa": "bcaas", "glutamine": "glutamine", "beta alanine": "beta-alanine", "tongkat": "tongkat", "maca": "maca", "test booster": "testosterone-booster", "testosterone booster": "testosterone-booster",
 "shilajit": "shilajit", "sea moss": "sea-moss", "chlorophyll": "chlorophyll", "colostrum": "colostrum", "nootropic": "nootropic", "alpha gpc": "nootropic", "iron": "iron", "dhea": "dhea", "biotin": "biotin", "coq10": "coq10", "resveratrol": "resveratrol", "elderberry": "elderberry",
 "fiber": "psyllium", "fibre": "psyllium", "psyllium": "psyllium", "enzymes": "digestive-enzymes", "berberine": "berberine", "saffron": "saffron", "rhodiola": "rhodiola", "glucosamine": "glucosamine", "inositol": "inositol", "calcium": "calcium", "primrose": "evening-primrose",
 "kava": "kava", "passionflower": "passionflower", "lemon balm": "lemon-balm", "chamomile": "chamomile", "sleepy tea": "sleep-tea-blend", "sleep tea": "sleep-tea-blend", "valerian": "valerian", "5htp": "5-htp", "gaba": "gaba", "cbd": "cbd", "lavender": "lavender", "apigenin": "apigenin", "glycine": "glycine", "zma": "zma", "k2": "vitamin-k2", "b complex": "b-complex",
 "sleep mask": "eye-mask", "sound machine": "white-noise", "sunrise alarm": "sunrise-alarm", "light box": "light-therapy-box", "sad lamp": "light-therapy-box", "massage gun": "massage-gun", "theragun": "massage-gun", "oura": "second-wearable", "whoop": "second-wearable", "second wearable": "second-wearable",
 "wake time": "consistent-wake-time", "same wake time": "consistent-wake-time", "sleep in": "weekend-sleep-in", "sleeping in": "weekend-sleep-in", "zone 2": "zone-2", "cardio": "zone-2", "morning workout": "morning-workout", "nsdr": "nsdr", "yoga nidra": "nsdr", "reading": "reading-paper", "tv in bed": "tv-in-the-bedroom", "work email": "work-email", "phone charging": "phone-charging", "smart lights": "smart-lights", "hue": "smart-lights",
}
alias_out = {}
unresolved = []
for term, frag in ALIASES.items():
    frag_l = frag.lower()
    hits = [it["k"] for it in items if frag_l in it["k"].lower() or frag_l in it["n"].lower()]
    exact = [it["k"] for it in items if it["k"].lower() == frag_l]
    if exact: hits = exact
    if len(hits) == 1:
        alias_out[term] = hits[0]
    else:
        unresolved.append((term, frag, hits[:4]))
if unresolved:
    print("UNRESOLVED ALIASES (term, fragment, candidates):")
    for u in unresolved: print("  ", u)

# ---------------------------------------------------------------------------
# Supporting tables
# ---------------------------------------------------------------------------
NUMBERS = {}
for r in list(wb["Numbers we can watch"].iter_rows(values_only=True))[1:]:
    if not r[0] or r[0].startswith("How ") or r[3] is None: continue
    NUMBERS[r[0]] = {"unit": s(r[1]), "oura": s(r[3]), "whoop": s(r[4]), "apple": s(r[5]), "garmin": s(r[6]), "swing": s(r[7]), "spot": s(r[8])}

GOALS = []
for r in list(wb["Goal to Number"].iter_rows(values_only=True))[3:]:
    if r[0]: GOALS.append({"goal": s(r[0]), "number": s(r[1]), "note": s(r[2]), "rating": s(r[3]) == "yes"})

GRADES = {"A": "well-run trials agree", "B": "proper trials, but small or mixed", "C": "a few small studies", "D": "stories, marketing, or lab-only", "N": "tested properly and found to do nothing"}

CHIPS = ["coffee-after-2pm", "alcohol-in-the-evening", "magnesium-any-form", "melatonin", "sauna-post-workout-or-evening", "training-after-7pm", "screens-phone-in-bed", "gym-membership", "greens-powder-ag1-etc", "collagen-peptides", "meditation-app-calm-headspace", "ashwagandha-ksm-66-sensoril", "vitamin-d3", "mouth-tape", "creatine-monohydrate"]
for c in CHIPS: assert c in by_key, c

data = {"built": "from Routing-Table.xlsx version 4", "items": items, "aliases": alias_out, "numbers": NUMBERS, "goals": GOALS, "grades": GRADES, "chips": CHIPS}
OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")))
print(f"wrote {OUT} ({OUT.stat().st_size//1024} KB): {len(items)} items, {sum(1 for i in items if 'rule' in i)} with rules, {len(alias_out)} aliases")
