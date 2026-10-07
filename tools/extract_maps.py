"""Pull the map layout images out of the two Google Sheets exports.

The sheets keep their maps as in-cell images, so the picture data lives in
xl/media while the column each one belongs to only shows up in the drawing
anchors. This walks the anchors, groups by column, drops duplicates, trims the
transparent margin and re-encodes to WebP.

Usage:  python tools/extract_maps.py scen.xlsx camp.xlsx
Writes: public/maps/{scenario,campaign}/*.webp and src/data/maps.json
"""

import hashlib
import io
import json
import posixpath
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import Path

import numpy as np
from PIL import Image

R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
M = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
NS = {
    "xdr": "http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing",
    "a": "http://schemas.openxmlformats.org/drawingml/2006/main",
    "r": R,
}

ROOT = Path(__file__).resolve().parent.parent
MAX_WIDTH = 1000
QUALITY = 82

# Which Data-sheet column feeds which generator slot. The sheets address these
# by letter, so keep the letters as the public names.
SCENARIO_COOP_COLUMNS = {"A": 2, "B": 3, "C": 4, "D": 5, "E": 6}
SCENARIO_CLASH_COLUMNS = {"F": 2, "G": 3, "H": 4, "I": 5, "J": 6}

# Pools the app supplies itself instead of taking from the sheet, keyed by
# (kind, slot, column). The files are committed under public/maps and are not
# produced by this script, so do not wipe public/maps before re-running it.
MAP_POOL_OVERRIDES = {
    # Coop Acts 2 and 3 share column B. These layouts replace the sheet's,
    # and three of them mark the enemy hero's starting tile in red.
    ("campaign", "coop", "B"): [
        "ee15160ed852.webp",
        "6b2ed9810c14.webp",
        "a9ec9dbf1c72.webp",
        "7f704fa6720c.webp",
        "dc39807305b7.webp",
        "57fb19ae1b10.webp",
        "dac8e4193ea4.webp",
        "b4f09d198f8f.webp",
        "9e1372b9b278.webp",
        "cac7fb47e4be.webp",
    ],
    # The sheets never gave Act 8 a layout; this one marks the two player
    # tiles H1/H2 and the three enemy tiles by their die result.
    ("campaign", "coop", "G"): ["eece2aa8c763.webp"],
    ("campaign", "solo", "G"): ["1e3ffc8f2d18.webp"],
}


def sheet_parts(z, name_filter=None):
    """Yield (sheet_name, drawing_xml, rel_id -> media path) for sheets with drawings."""
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    wb_rels = {
        r.get("Id"): r.get("Target")
        for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    }
    for sh in wb.find("{%s}sheets" % M):
        name = sh.get("name")
        if name_filter and name.strip() not in name_filter:
            continue
        target = wb_rels[sh.get("{%s}id" % R)].lstrip("/")
        if not target.startswith("xl/"):
            target = "xl/" + target
        sx = ET.fromstring(z.read(target))
        drawing = sx.find("{%s}drawing" % M)
        if drawing is None:
            continue
        base = posixpath.dirname(target)
        srels = {
            r.get("Id"): r.get("Target")
            for r in ET.fromstring(
                z.read(posixpath.join(base, "_rels", posixpath.basename(target) + ".rels"))
            )
        }
        dpath = posixpath.normpath(
            posixpath.join(base, srels[drawing.get("{%s}id" % R)])
        )
        dbase = posixpath.dirname(dpath)
        try:
            drels = {
                r.get("Id"): posixpath.normpath(posixpath.join(dbase, r.get("Target")))
                for r in ET.fromstring(
                    z.read(
                        posixpath.join(
                            dbase, "_rels", posixpath.basename(dpath) + ".rels"
                        )
                    )
                )
            }
        except KeyError:
            drels = {}
        yield name.strip(), ET.fromstring(z.read(dpath)), drels


def cells_with_images(z, sheet_name):
    """{'A': ['xl/media/image2.png', ...]} in sheet row order for one sheet."""
    for name, dx, drels in sheet_parts(z, {sheet_name}):
        found = []
        for anchor in dx:
            frm = anchor.find("xdr:from", NS)
            blip = anchor.find(".//a:blip", NS)
            if frm is None or blip is None:
                continue
            col = chr(65 + int(frm.find("xdr:col", NS).text))
            row = int(frm.find("xdr:row", NS).text)
            found.append((col, row, drels[blip.get("{%s}embed" % R)]))
        by_col = {}
        for col, row, media in sorted(found, key=lambda t: (t[0], t[1])):
            by_col.setdefault(col, []).append(media)
        return by_col
    return {}


def clash_references(z):
    """Clash map columns are formulas pointing back at the coop columns (=A1, =C2...).

    Returns {'F': [('A', 0), ...]} — column letter and zero-based row.
    """
    wb = ET.fromstring(z.read("xl/workbook.xml"))
    wb_rels = {
        r.get("Id"): r.get("Target")
        for r in ET.fromstring(z.read("xl/_rels/workbook.xml.rels"))
    }
    target = None
    for sh in wb.find("{%s}sheets" % M):
        if sh.get("name").strip() == "Maps":
            target = wb_rels[sh.get("{%s}id" % R)].lstrip("/")
    if not target:
        return {}
    if not target.startswith("xl/"):
        target = "xl/" + target
    sx = ET.fromstring(z.read(target))
    refs = {}
    for c in sx.iter("{%s}c" % M):
        f = c.find("{%s}f" % M)
        if f is None or not f.text:
            continue
        m = re.fullmatch(r"([A-Z])(\d+)", f.text.strip())
        if not m:
            continue
        col = re.match(r"([A-Z]+)", c.get("r")).group(1)
        if col in SCENARIO_CLASH_COLUMNS:
            refs.setdefault(col, []).append((m.group(1), int(m.group(2)) - 1))
    return refs


def flood_from_border(candidate):
    """Which candidate pixels are reachable from the edge of the image."""
    reach = np.zeros_like(candidate)
    reach[0, :] = candidate[0, :]
    reach[-1, :] = candidate[-1, :]
    reach[:, 0] = candidate[:, 0]
    reach[:, -1] = candidate[:, -1]
    while True:
        grown = reach.copy()
        grown[1:, :] |= reach[:-1, :]
        grown[:-1, :] |= reach[1:, :]
        grown[:, 1:] |= reach[:, :-1]
        grown[:, :-1] |= reach[:, 1:]
        grown &= candidate
        if np.array_equal(grown, reach):
            return reach
        reach = grown


def key_out_white(img):
    """Drop a flat white background, if the image has one instead of alpha.

    Some maps were pasted into the sheet over white rather than with
    transparency. Only white that is *connected to the edge* is removed, so the
    white stars inside the tiles survive; the gaps between tiles go too, since
    they open onto the outside. Near-white pixels fade out rather than cut, to
    keep the anti-aliased tile edges from leaving a hard fringe.
    """
    arr = np.array(img)
    if arr[..., 3].min() < 250:
        return img  # already has real transparency
    lo = arr[..., :3].min(axis=2)
    corners = [lo[0, 0], lo[0, -1], lo[-1, 0], lo[-1, -1]]
    if sum(1 for c in corners if c >= 225) < 3:
        return img  # background is not white

    background = flood_from_border(lo >= 200)
    faded = np.clip((235 - lo.astype(np.int16)) * 255 // 35, 0, 255)
    arr[..., 3] = np.where(background, faded, arr[..., 3]).astype(np.uint8)
    return Image.fromarray(arr)


def encode(raw, out_dir, seen):
    """Trim, downscale and write one image as WebP. Returns its filename."""
    digest = hashlib.sha1(raw).hexdigest()[:12]
    if digest in seen:
        return seen[digest]
    img = key_out_white(Image.open(io.BytesIO(raw)).convert("RGBA"))
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)
    if img.width > MAX_WIDTH:
        h = round(img.height * MAX_WIDTH / img.width)
        img = img.resize((MAX_WIDTH, h), Image.LANCZOS)
    name = "%s.webp" % digest
    out_dir.mkdir(parents=True, exist_ok=True)
    img.save(out_dir / name, "WEBP", quality=QUALITY, method=6)
    seen[digest] = name
    return name


def dedupe(names):
    """Keep first occurrence — a map listed twice in a column is just a duplicate row."""
    out = []
    for n in names:
        if n not in out:
            out.append(n)
    return out


def main(scen_path, camp_path):
    manifest = {"scenario": {"coop": {}, "clash": {}}, "campaign": {"solo": {}, "coop": {}}}
    seen = {}

    with zipfile.ZipFile(scen_path) as z:
        by_col = cells_with_images(z, "Maps")
        media = {}  # (col, row) -> filename
        out_dir = ROOT / "public" / "maps" / "scenario"
        for col, paths in by_col.items():
            for row, p in enumerate(paths):
                media[(col, row)] = encode(z.read(p), out_dir, seen)
        for col, players in SCENARIO_COOP_COLUMNS.items():
            manifest["scenario"]["coop"][str(players)] = dedupe(
                [media[(col, r)] for r in range(len(by_col.get(col, [])))]
            )
        refs = clash_references(z)
        for col, players in SCENARIO_CLASH_COLUMNS.items():
            picked = [media[key] for key in refs.get(col, []) if key in media]
            manifest["scenario"]["clash"][str(players)] = dedupe(picked)

    with zipfile.ZipFile(camp_path) as z:
        out_dir = ROOT / "public" / "maps" / "campaign"
        for sheet, slot in (("Maps", "solo"), ("Maps_coop", "coop")):
            for col, paths in cells_with_images(z, sheet).items():
                manifest["campaign"][slot][col] = dedupe(
                    [encode(z.read(p), out_dir, seen) for p in paths]
                )

    for (kind, slot, column), names in MAP_POOL_OVERRIDES.items():
        manifest[kind][slot][column] = names

    dest = ROOT / "src" / "data" / "maps.json"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    # An override leaves the pool it replaced on disk but unreferenced, so say so
    # rather than letting dead files pile up in the repo.
    referenced = {
        name
        for group in manifest.values()
        for slot in group.values()
        for names in slot.values()
        for name in names
    }
    stray = sorted(
        f.name for f in (ROOT / "public" / "maps").rglob("*.webp")
        if f.name not in referenced
    )
    if stray:
        print("unreferenced, safe to delete: %s" % ", ".join(stray))

    total = sum(
        f.stat().st_size for f in (ROOT / "public" / "maps").rglob("*.webp")
    )
    print("%d unique images, %.1f MB" % (len(seen), total / 1e6))
    for kind, groups in manifest.items():
        for slot, cols in groups.items():
            print(" ", kind, slot, {k: len(v) for k, v in sorted(cols.items())})


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
