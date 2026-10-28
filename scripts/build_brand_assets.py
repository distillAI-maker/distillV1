"""Build Distill's logo and profile pictures as SVG (public/assets/brand/).

The mark is the solid star (Veer, 27 Oct): the Figma eight-point chisel star
(apps/web/components/d-star.tsx) filled in, with one persimmon dot, the choice, at its centre.
The wordmark is Newsreader, outlined to paths so the files need no font.
Run: python3 scripts/build_brand_assets.py   (PNG exports: scripts/export_brand_pngs.sh)
"""
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/assets/brand"

GROUND, PARCHMENT, PERSIMMON, WALNUT, INK = "#f0ece2", "#ddd3bf", "#f26342", "#4a3126", "#11191b"

# The star on a 40-unit box, centred on (20, 20), exactly as the app draws it.
STAR = ("M20 2.5l3.8 12.8 9.7-8.6-8.7 9.6 12.7 3.7-12.7 3.7 8.7 9.6-9.7-8.6L20 37.5"
        "l-3.8-12.8-9.7 8.6 8.7-9.6L2.5 20l12.7-3.7-8.7-9.6 9.7 8.6L20 2.5z")


def star(x, y, size, color, core=None):
    """The solid star in a size x size box at (x, y): one filled shape, one dot."""
    s = size / 40
    return (f'<g transform="translate({x:.2f} {y:.2f}) scale({s:.4f})">'
            f'<path d="{STAR}" fill="{color}"/>'
            f'<circle cx="20" cy="20" r="3.6" fill="{core or color}"/></g>')


def wordmark_font():
    # The live wordmark: Newsreader 500 (site.css .wordmark), tracked -0.03em so the "ill" serifs keep a hair of air at logo size.
    font = TTFont(ROOT / "public/assets/fonts/newsreader.woff2")
    return instantiateVariableFont(font, {"wght": 500, "opsz": 28})


def kern_pairs(font):
    """Pair kerning from GPOS (formats 1 and 2) as {(left, right): xAdvance}."""
    pairs, gpos = {}, font["GPOS"].table
    idx = [i for fr in gpos.FeatureList.FeatureRecord if fr.FeatureTag == "kern" for i in fr.Feature.LookupListIndex]
    for i in idx:
        lookup = gpos.LookupList.Lookup[i]
        for st in lookup.SubTable:
            if lookup.LookupType == 9:
                st = st.ExtSubTable
            if getattr(st, "LookupType", 2) != 2 and lookup.LookupType not in (2, 9):
                continue
            cov = st.Coverage.glyphs
            if st.Format == 1:
                for g, ps in zip(cov, st.PairSet):
                    for r in ps.PairValueRecord:
                        v = getattr(r.Value1, "XAdvance", 0) if r.Value1 else 0
                        pairs.setdefault((g, r.SecondGlyph), v)
            elif st.Format == 2:
                c1, c2 = st.ClassDef1.classDefs, st.ClassDef2.classDefs
                for g in cov:
                    rec = st.Class1Record[c1.get(g, 0)]
                    for g2, k2 in list(c2.items()):
                        v = rec.Class2Record[k2].Value1
                        x = getattr(v, "XAdvance", 0) if v else 0
                        if x:
                            pairs.setdefault((g, g2), x)
    return pairs


def text_path(font, text, size, tracking=-0.03):
    """Outline text at `size` px with its baseline at y=0. Returns (d, width, cap)."""
    upm = font["head"].unitsPerEm
    cmap, gs, hmtx = font.getBestCmap(), font.getGlyphSet(), font["hmtx"]
    kern = kern_pairs(font)
    scale = size / upm
    names = [cmap[ord(c)] for c in text]
    pen = SVGPathPen(gs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
    x = 0
    for n, (i, name) in zip(names, enumerate(names)):
        gs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, 0)))
        x += hmtx[name][0] * scale + tracking * size
        if i + 1 < len(names):
            x += kern.get((name, names[i + 1]), 0) * scale
    width = x - tracking * size
    return pen.getCommands(), width, font["OS/2"].sCapHeight * scale


def svg(w, h, body, label):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:g} {h:g}" width="{w:g}" height="{h:g}" '
            f'role="img" aria-label="{label}">\n{body}\n</svg>\n')


def lockup(font, color, core=None):
    # Proportions from Veer's pick (27 Oct): star 0.96em, gap 0.22em, centred 0.26em above the baseline.
    size, pad = 112, 8
    mark, gap = 0.96 * size, 0.22 * size
    d, tw, cap = text_path(font, "Distill", size)
    top = pad
    baseline = top + mark / 2 + 0.26 * size
    x0 = pad + mark + gap
    body = (star(pad, top, mark, color, core) +
            f'\n<path transform="translate({x0:.2f} {baseline:.2f})" d="{d}" fill="{color}"/>')
    return svg(round(x0 + tw + pad), round(top + mark + pad), body, "Distill")


def mark_only(color, core=None):
    return svg(120, 120, star(10, 10, 100, color, core), "Distill")


# Profile pictures: a full-bleed square, star kept inside the circle crop.
PROFILES = {
    "a-ink":       dict(bg=INK,       star=GROUND, core=PERSIMMON, label="Ink"),
    "b-ground":    dict(bg=GROUND,    star=INK,    core=PERSIMMON, label="Ground"),
    "c-persimmon": dict(bg=PERSIMMON, star=INK,    core=PERSIMMON, label="Persimmon"),
}


def profile(p, size=1080, mark_ratio=0.5):
    m = size * mark_ratio
    o = (size - m) / 2
    body = f'<rect width="{size}" height="{size}" fill="{p["bg"]}"/>\n' + star(o, o, m, p["star"], p["core"])
    return svg(size, size, body, "Distill")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    font = wordmark_font()
    files = {
        "distill-logo-light.svg": lockup(font, INK, PERSIMMON),       # for light grounds
        "distill-logo-dark.svg": lockup(font, GROUND, PERSIMMON),     # for dark grounds
        "distill-mark-light.svg": mark_only(INK, PERSIMMON),
        "distill-mark-dark.svg": mark_only(GROUND, PERSIMMON),
    }
    for key, p in PROFILES.items():
        files[f"profile-{key}.svg"] = profile(p)
    for name, text in files.items():
        (OUT / name).write_text(text)
        print("wrote", (OUT / name).relative_to(ROOT))


if __name__ == "__main__":
    main()
