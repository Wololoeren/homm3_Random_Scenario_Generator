"""Shrink the page furniture and fonts copied in from the other repos.

The art arrives at print resolution for A4 spreads; most of it is drawn far
smaller here, and PNG is a poor fit for photographic textures. This re-encodes
each piece to WebP at the size it is actually used, and converts the fonts to
WOFF2.

Safe to re-run: it reads from the checked-in files and overwrites in place.

Usage:  python tools/optimise_assets.py
"""
from pathlib import Path

from PIL import Image
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
LAYOUT = ROOT / "public" / "layout"
FONTS = ROOT / "public" / "fonts"

# name -> widest it is ever drawn, in pixels at roughly 300 dpi.
# "None" keeps the original width.
TARGETS = {
    "section_heading.png": None,   # ~166mm wide, already under 300 dpi
    "bottom.png": None,            # full page width
    "random.png": 420,             # a 26mm icon
    "tausta.png": 900,             # a soft texture stretched over the page
    "listdot.png": None,           # already tiny
}


def convert_images():
    for name, width in TARGETS.items():
        src = LAYOUT / name
        if not src.exists():
            continue
        img = Image.open(src).convert("RGBA")
        if width and img.width > width:
            height = round(img.height * width / img.width)
            img = img.resize((width, height), Image.LANCZOS)
        dest = src.with_suffix(".webp")
        img.save(dest, "WEBP", quality=88, method=6)
        before, after = src.stat().st_size, dest.stat().st_size
        print("  %-24s %5.0f KB -> %5.0f KB  (%dx%d)" % (
            name, before / 1024, after / 1024, img.width, img.height))
        src.unlink()


def convert_fonts():
    for src in sorted(FONTS.glob("*.ttf")):
        font = TTFont(src)
        font.flavor = "woff2"
        dest = src.with_suffix(".woff2")
        font.save(dest)
        before, after = src.stat().st_size, dest.stat().st_size
        print("  %-34s %5.0f KB -> %5.0f KB" % (
            src.name, before / 1024, after / 1024))
        src.unlink()


if __name__ == "__main__":
    print("layout art:")
    convert_images()
    print("fonts:")
    convert_fonts()
