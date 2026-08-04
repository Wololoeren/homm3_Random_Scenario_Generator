"""Turn the two Google Sheets exports into the JSON the generator reads.

Everything the app rolls on lives in the sheets' Data tabs, one column per
slot; the reference tabs (Stack, AI-army, AI, Glossary) are copied across as
printable tables. Re-run this after editing the sheets to pick up changes.

Usage:  python tools/extract_tables.py scen.xlsx camp.xlsx
Writes: src/data/scenario.json and src/data/campaign.json
"""

import json
import re
import sys
from pathlib import Path

import openpyxl

ROOT = Path(__file__).resolve().parent.parent

# Column letter -> (id, printed label). The ids are what the app stores in
# saved settings, so they must stay stable even if a label is reworded.
SCENARIO_COLUMNS = [
    ("A", "buildings", "Starting Buildings"),
    ("B", "resources", "Starting Resources"),
    ("C", "army", "Starting Army"),
    ("D", "victoryCoop", "Victory Conditions (Coop)"),
    ("E", "timedEvents", "Timed Events"),
    ("F", "obelisk", "Obelisk Reward"),
    ("G", "positive", "Positive Condition"),
    ("H", "neutral", "Neutral Condition"),
    ("I", "negative", "Negative Condition"),
    ("J", "aiBehaviour", "AI Behaviour"),
    ("K", "victoryClash", "Victory Conditions (Clash)"),
]

CAMPAIGN_COLUMNS = [
    ("A", "faction", "Factions"),
    ("B", "victoryAct1", "Act 1 Victory Condition"),
    ("C", "army", "Starting Army"),
    ("D", "obelisk", "Obelisk Reward"),
    ("E", "farTiles", "Far Tile Selection"),
    ("F", "timedEvents", "Timed Events"),
    ("G", "completionReward", "Completion Reward"),
    ("H", "nearTiles", "Near Tile Selection"),
    ("I", "dungeonTiles", "Dungeon Tile Selection"),
    ("K", "aiBehaviour", "AI Behaviour"),
]

# The AI-army tables carry a second piece of information in the cell fill: how
# many AI behaviours that army fights with. Nothing in the text says so, so the
# colours are read back into a number here.
BEHAVIOUR_FILLS = {
    "FF00FF00": 0,  # green
    "FFFFFF00": 1,  # yellow
    "FFF6B26B": 2,  # orange
    "FFE06666": 3,  # red
}

# Corrections applied to every entry as it is read, so the printed sheet reads
# cleanly without anyone having to tidy the spreadsheets. Spelling and grammar
# only — nothing here is allowed to change what a rule does.
CORRECTIONS = [
    # The board game has no "Capital" building; it is the Citadel.
    (re.compile(r"\bCapital\b"), "Citadel"),

    # Spelling.
    (re.compile(r"\bSeach\b"), "Search"),
    (re.compile(r"\bseach\b"), "search"),
    (re.compile(r"\bcorrespondign\b"), "corresponding"),
    (re.compile(r"\bimmediatly\b"), "immediately"),
    (re.compile(r"\bunavaliable\b"), "unavailable"),
    (re.compile(r"\bdetermind\b"), "determined"),
    (re.compile(r"\binitative\b"), "initiative"),
    (re.compile(r"\bretailation\b"), "retaliation"),
    (re.compile(r"\bNeural\b"), "Neutral"),
    (re.compile(r"\bteh\b"), "the"),
    (re.compile(r"\bupto\b"), "up to"),
    (re.compile(r"\binfront\b"), "in front"),
    (re.compile(r"\bpriorities\b"), "prioritise"),
    (re.compile(r"\bdiscard pil\b"), "discard pile"),
    (re.compile(r"\bFirstaid tent\b"), "First Aid Tent"),
    (re.compile(r"\bpandoras box\b", re.I), "Pandora's Box"),
    (re.compile(r"\bacheive\b"), "achieved"),
    (re.compile(r"\bAl's\b"), "AI's"),
    # "Loose" for "lose", and "back cube" for "black cube".
    (re.compile(r"\bLoose\b"), "Lose"),
    (re.compile(r"\bback cube\b"), "black cube"),
    # Morale, consistently.
    (re.compile(r"\bmoral\b"), "morale"),
    (re.compile(r"\bMoral\b"), "Morale"),

    # Grammar.
    (re.compile(r"\bit's\b"), "its"),
    (re.compile(r"\brange (attack|unit)"), r"ranged \1"),
    (re.compile(r"\bEach players gains\b"), "Each player gains"),
    (re.compile(r"\bEach player are attacked\b"), "Each player is attacked"),
    (re.compile(r"\bDecrease you hero\b"), "Decrease your hero"),
    (re.compile(r"\bback to you town\b"), "back to your town"),
    (re.compile(r"\bhave achieved\b"), "has achieved"),
    (re.compile(r"\bPlayer start by\b"), "Players start by"),
    (re.compile(r"\bHeroes starts with\b"), "Heroes start with"),
    (re.compile(r"\bfields counts as\b"), "fields count as"),
    (re.compile(r"\bEvery unit deal\b"), "Every unit deals"),
    (re.compile(r"\bwere flip or killed\b"), "were flipped or killed"),
    (re.compile(r"\bAI place a\b"), "AI places a"),
    (re.compile(r"\bAI Heal the\b"), "AI heals the"),
    (re.compile(r"\bit prevent you\b"), "it prevents you"),
    (re.compile(r"\bwhere it possible\b"), "where it is possible"),
    (re.compile(r"\bfind 3 Obelisk\b"), "find 3 Obelisks"),
    (re.compile(r"\breplaced with a creature banks\b"), "replaced with creature banks"),
    (re.compile(r"\b9 damage token\b"), "9 damage tokens"),
    (re.compile(r"\. the dragon\b"), ". The dragon"),
    (re.compile(r"\ball black cube from\b"), "all black cubes from"),
    (re.compile(r"\bremove you a starting\b"), "remove a starting"),
    (re.compile(r"\bmechnics\b"), "mechanics"),
    (re.compile(r"\bstrategi\b"), "strategy"),
    (re.compile(r"\bBattleling\b"), "Battling"),
    (re.compile(r"\buse a monoliths\b"), "use a monolith"),
    (re.compile(r"\bAI army give\b"), "AI army gives"),
    (re.compile(r"\bBattling the AI cost\b"), "Battling the AI costs"),
    # The hero's gender is never established, so "his town" becomes neutral.
    (re.compile(r"\bmove towards his town\b"), "move towards their town"),
    (
        re.compile(r"Search \(2\) your discard pile on round 2 and 4"),
        "Search (2) your discard pile at the end round 2 and 4",
    ),
    (re.compile(r"\bNecroploish\b"), "Necropolis"),
    (re.compile(r"\bearthquack\b"), "earthquake"),
    (re.compile(r"\bcolapse\b"), "collapse"),
    (re.compile(r"\bfleed\b"), "fled"),
    (re.compile(r"\bthier\b"), "their"),
    (re.compile(r"\bstriped\b"), "stripped"),
    (re.compile(r"\bdecribtion\b"), "description"),
    (re.compile(r"\bagianst\b"), "against"),
    (re.compile(r"\bExpert abilities does not\b"), "Expert abilities do not"),
    (re.compile(r"\bunits gains\b"), "units gain"),
    # "Search(2)" and "search (2)" both appear; settle on one form.
    (re.compile(r"\b[Ss]earch\s*\((\d)\)"), r"Search (\1)"),

    # Whitespace the sheets picked up from editing.
    (re.compile(r"[ \t]{2,}"), " "),
    (re.compile(r" +([,.])"), r"\1"),
]

# Glossary rows that explain notation the app now draws as icons, so the entry
# has nothing left to explain.
SKIP_GLOSSARY = {"Unit T#F or T#P", ".+st", "T2P+st", "T7F"}

# Options the app offers that the spreadsheets do not have a row for yet.
CAMPAIGN_EXTRA_ENTRIES = {
    "timedEvents": ["Remove black cubes from your starting tile on round 2."],
}

# Where the app deliberately departs from the sheet. Acts 2 and 3 have a fixed
# timed event in the spreadsheet; rolling them from the same pool as Act 1
# gives the middle of a campaign the same variety as its opening.
CAMPAIGN_ACT_OVERRIDES = {
    (2, "timed"): ("roll", "timedEvents"),
    (3, "timed"): ("roll", "timedEvents"),
}

FACTION_ORDER = [
    "Castle", "Tower", "Rampart", "Inferno", "Necropolis",
    "Dungeon", "Fortress", "Stronghold", "Conflux", "Cove",
]


def clean(value):
    if value is None:
        return ""
    text = str(value).replace("\r\n", "\n").strip()
    for pattern, replacement in CORRECTIONS:
        text = pattern.sub(replacement, text)
    return text


def column(ws, letter, limit=200):
    """Non-empty cells of one column, top to bottom."""
    out = []
    for row in range(1, limit + 1):
        v = clean(ws["%s%d" % (letter, row)].value)
        if v:
            out.append(v)
    return out


def slug(text, used):
    """Stable-ish id for one entry, so disabling survives reordering."""
    base = "".join(ch.lower() if ch.isalnum() else "-" for ch in text)[:44]
    base = "-".join(filter(None, base.split("-"))) or "entry"
    n, candidate = 2, base
    while candidate in used:
        candidate = "%s-%d" % (base, n)
        n += 1
    used.add(candidate)
    return candidate


def read_columns(ws, spec, extras=None):
    out = []
    for letter, cid, label in spec:
        used = set()
        texts = column(ws, letter) + list((extras or {}).get(cid, []))
        entries = [{"id": slug(text, used), "text": text} for text in texts]
        out.append({"id": cid, "column": letter, "label": label, "entries": entries})
    return out


def grid(ws, first_row, last_row, cols):
    rows = []
    for r in range(first_row, last_row + 1):
        rows.append([clean(ws["%s%d" % (c, r)].value) for c in cols])
    return rows


def behaviour_grid(ws, first_row, last_row, cols):
    """Behaviour count per cell, read from the fill colour. None where unshaded."""
    rows = []
    for r in range(first_row, last_row + 1):
        row = []
        for c in cols:
            rgb = getattr(ws["%s%d" % (c, r)].fill.fgColor, "rgb", None)
            row.append(BEHAVIOUR_FILLS.get(rgb) if isinstance(rgb, str) else None)
        rows.append(row)
    return rows


def scenario_reference(wb):
    stack = wb["Stack"]
    army = wb["AI-army"]
    ai = wb["AI"]
    glossary = wb["Glossary"]

    def table(ws, header_row, first, last, cols=("A", "B", "C", "D", "E")):
        return {
            "title": clean(ws["A%d" % header_row].value),
            "headers": [clean(ws["%s%d" % (c, header_row)].value) for c in cols[1:]],
            "rows": grid(ws, first, last, cols),
            "behaviours": behaviour_grid(ws, first, last, cols),
        }

    return {
        "stack": {
            "title": "Enemy Stacks",
            "headers": ["Easy", "Normal", "Hard", "Impossible"],
            "rows": grid(stack, 2, 4, ("A", "B", "C", "D", "E")),
        },
        "aiArmy": [
            table(army, 1, 2, 17),
            table(army, 18, 19, 34),
            table(army, 35, 36, 51),
        ],
        "behaviourCount": column(army, "G", 10),
        "aiRules": column(ai, "A", 30),
        "glossary": [
            {"term": clean(glossary["A%d" % r].value),
             "text": clean(glossary["B%d" % r].value),
             "note": clean(glossary["C%d" % r].value)}
            for r in range(1, 30)
            if clean(glossary["A%d" % r].value)
            and clean(glossary["A%d" % r].value) not in SKIP_GLOSSARY
        ],
    }


# The campaign tabs lay each Act out in a pair of columns: labels on the left,
# values on the right, one row per field.
CAMPAIGN_ACT_ROWS = {
    2: "map", 3: "story", 4: "actInfo", 5: "tiles",
    6: "row6", 7: "row7", 8: "row8", 9: "row9",
    10: "tilesOnHand", 11: "victory", 12: "timed", 13: "lastRound",
    14: "reward", 15: "completion", 16: "completionStory",
}

CAMPAIGN_ACT_COLUMNS = [
    ("A", "B"), ("C", "D"), ("E", "F"), ("G", "H"),
    ("I", "J"), ("K", "L"), ("M", "N"), ("O", "P"),
]

DATA_COLUMN_IDS = {letter: cid for letter, cid, _ in CAMPAIGN_COLUMNS}


def campaign_acts(formulas, values, sheet):
    """One entry per Act, saying for each field whether it is fixed, rolled, or
    built from the cast of characters.

    "formula" fields keep the spreadsheet's last cached value as well, so an Act
    still prints something sensible if the app has no template for it.
    """
    fs, vs = formulas[sheet], values[sheet]
    acts = []
    for n, (label_col, value_col) in enumerate(CAMPAIGN_ACT_COLUMNS, start=1):
        fields = {}
        for row, name in CAMPAIGN_ACT_ROWS.items():
            # Labels are written with their colon in the sheet; the sheet
            # component adds its own.
            label = clean(vs["%s%d" % (label_col, row)].value).rstrip(":").strip()
            text = clean(vs["%s%d" % (value_col, row)].value)
            formula = fs["%s%d" % (value_col, row)].value
            if not label and not text:
                continue

            kind, source = "text", None
            override = CAMPAIGN_ACT_OVERRIDES.get((n, name))
            if override:
                kind, source = override
                fields[name] = {
                    "label": label, "kind": kind, "source": source, "text": text,
                }
                continue
            if isinstance(formula, str) and formula.startswith("="):
                maps = re.search(r"FILTER\(Maps(?:_coop)?!([A-Z]):", formula)
                data = re.search(r"FILTER\(Data!([A-Z]):", formula)
                if maps:
                    kind, source = "map", maps.group(1)
                elif data and "CONCATENATE" not in formula:
                    kind, source = "roll", DATA_COLUMN_IDS.get(data.group(1))
                else:
                    kind = "formula"

            fields[name] = {"label": label, "kind": kind, "source": source, "text": text}
        acts.append({"act": n, "fields": fields})
    return acts


def campaign_reference(wb):
    army = wb["AI-army"]
    ai = wb["AI"]
    glossary = wb["Glossary"]
    heroes = wb["Heroes"]
    speciality = wb["AI Hero Speciality"]

    by_faction = {}
    for i, faction in enumerate(FACTION_ORDER, start=1):
        names = [
            clean(heroes.cell(row=i, column=c).value)
            for c in range(1, 25)
            if clean(heroes.cell(row=i, column=c).value)
        ]
        by_faction[faction] = names

    specialities = {}
    for r in range(1, 120):
        name = clean(speciality["A%d" % r].value)
        if name:
            specialities[name] = clean(speciality["B%d" % r].value)

    return {
        "heroes": by_faction,
        "specialities": specialities,
        "aiArmy": [
            {"title": clean(army["A1"].value),
             "headers": ["Easy", "Normal", "Hard", "Impossible"],
             "rows": grid(army, 2, 17, ("A", "B", "C", "D", "E")),
             "behaviours": behaviour_grid(army, 2, 17, ("A", "B", "C", "D", "E"))},
            {"title": clean(army["A18"].value),
             "headers": ["Easy", "Normal", "Hard", "Impossible"],
             "rows": grid(army, 19, 34, ("A", "B", "C", "D", "E")),
             "behaviours": behaviour_grid(army, 19, 34, ("A", "B", "C", "D", "E"))},
        ],
        "behaviourCount": column(army, "A", 40)[-4:],
        "aiRules": column(ai, "A", 30),
        "glossary": [
            {"term": clean(glossary["A%d" % r].value),
             "text": clean(glossary["B%d" % r].value),
             "note": clean(glossary["C%d" % r].value)}
            for r in range(1, 30)
            if clean(glossary["A%d" % r].value)
            and clean(glossary["A%d" % r].value) not in SKIP_GLOSSARY
        ],
    }


def main(scen_path, camp_path):
    out_dir = ROOT / "src" / "data"
    out_dir.mkdir(parents=True, exist_ok=True)

    wb = openpyxl.load_workbook(scen_path, data_only=True)
    scenario = {
        "columns": read_columns(wb["Data"], SCENARIO_COLUMNS),
        "reference": scenario_reference(wb),
    }
    (out_dir / "scenario.json").write_text(
        json.dumps(scenario, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    wb = openpyxl.load_workbook(camp_path, data_only=True)
    wb_formulas = openpyxl.load_workbook(camp_path)
    story = wb["Story"]
    campaign = {
        "columns": read_columns(wb["Data"], CAMPAIGN_COLUMNS, CAMPAIGN_EXTRA_ENTRIES),
        "epithets": column(story, "B", 40),
        "villainWords": column(story, "C", 40),
        "acts": {
            "solo": campaign_acts(wb_formulas, wb, "Campaign "),
            "coop": campaign_acts(wb_formulas, wb, "Coop campaign (WIP)"),
        },
        "reference": campaign_reference(wb),
    }
    (out_dir / "campaign.json").write_text(
        json.dumps(campaign, indent=2, ensure_ascii=False), encoding="utf-8"
    )

    for name, doc in (("scenario", scenario), ("campaign", campaign)):
        print(name, {c["id"]: len(c["entries"]) for c in doc["columns"]})


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
