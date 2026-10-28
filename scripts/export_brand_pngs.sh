#!/usr/bin/env bash
# Export PNGs of the brand SVGs with headless Chrome (no other tools needed).
# Usage: scripts/export_brand_pngs.sh   (run build_brand_assets.py first)
set -euo pipefail
cd "$(dirname "$0")/../public/assets/brand"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"
shot() { # svg, out.png, width, height
  printf '<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:%spx;height:%spx}</style><img src="%s">' \
    "$3" "$4" "$PWD/$1" > "$TMP/page.html"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --window-size="$3,$4" --screenshot="$PWD/$2" "file://$TMP/page.html" >/dev/null 2>&1
}
for f in profile-*.svg; do
  for s in 400 1080; do shot "$f" "png/${f%.svg}-$s.png" $s $s; done
done
for f in distill-logo-*.svg distill-mark-*.svg; do
  w=$(sed -n 's/.*viewBox="0 0 \([0-9.]*\) \([0-9.]*\)".*/\1/p' "$f" | head -1)
  h=$(sed -n 's/.*viewBox="0 0 \([0-9.]*\) \([0-9.]*\)".*/\2/p' "$f" | head -1)
  shot "$f" "png/${f%.svg}.png" $((w*4)) $((h*4))   # 4x, transparent
done
rm -rf "$TMP"
ls -1 png
