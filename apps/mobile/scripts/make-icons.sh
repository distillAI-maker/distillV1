#!/usr/bin/env bash
# Draws the iOS app icon (light, dark and tinted) and the launch screen's star from the brand mark,
# with headless Chrome like scripts/export_brand_pngs.sh. The star is the same path as
# apps/web/components/d-star.tsx and public/assets/brand (Veer's solid star, persimmon dot).
# Usage: apps/mobile/scripts/make-icons.sh
set -euo pipefail
cd "$(dirname "$0")/../ios/App/App/Assets.xcassets"
CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
TMP="$(mktemp -d)"
STAR='M20 2.5l3.8 12.8 9.7-8.6-8.7 9.6 12.7 3.7-12.7 3.7 8.7 9.6-9.7-8.6L20 37.5l-3.8-12.8-9.7 8.6 8.7-9.6L2.5 20l12.7-3.7-8.7-9.6 9.7 8.6L20 2.5z'
GROUND='#f0ece2' INK='#11191b' PERSIMMON='#f26342'

# svg <file> <canvas> <background or none> <star> <dot> <star share of the canvas>
svg() {
  local box offset bg=""
  box=$(echo "$2 * $6 / 0.875" | bc -l)   # the star spans 35 of its 40-unit box
  offset=$(echo "($2 - $box) / 2" | bc -l)
  [ "$3" != none ] && bg="<rect width=\"$2\" height=\"$2\" fill=\"$3\"/>"
  printf '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %s %s" width="%s" height="%s">%s<g transform="translate(%.2f %.2f) scale(%.4f)"><path d="%s" fill="%s"/><circle cx="20" cy="20" r="3.6" fill="%s"/></g></svg>' \
    "$2" "$2" "$2" "$2" "$bg" "$offset" "$offset" "$(echo "$box / 40" | bc -l)" "$STAR" "$4" "$5" > "$TMP/$1"
}

# shot <svg> <out.png> <px> <transparent: yes|no>
shot() {
  local flags=()
  [ "$4" = yes ] && flags=(--default-background-color=00000000)
  printf '<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:%spx;height:%spx}</style><img src="%s">' \
    "$3" "$3" "$TMP/$1" > "$TMP/page.html"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 ${flags[@]+"${flags[@]}"} \
    --window-size="$3,$3" --screenshot="$PWD/$2" "file://$TMP/page.html" >/dev/null 2>&1
}

# App icon: ink star on ground; ground star on ink for dark mode; a grey star for tinted mode.
# The App Store rejects icons with an alpha channel, so these are drawn opaque.
svg light.svg 1024 "$GROUND" "$INK" "$PERSIMMON" 0.58
svg dark.svg 1024 "$INK" "$GROUND" "$PERSIMMON" 0.58
svg tinted.svg 1024 '#000000' '#ffffff' '#8c8c8c' 0.58
shot light.svg AppIcon.appiconset/AppIcon-1024.png 1024 no
shot dark.svg AppIcon.appiconset/AppIcon-1024-dark.png 1024 no
shot tinted.svg AppIcon.appiconset/AppIcon-1024-tinted.png 1024 no

# Launch screen star: 64 pt, on a transparent ground (the screen behind it is Ground).
svg launch.svg 64 none "$INK" "$PERSIMMON" 0.875
for s in 1 2 3; do
  suffix=$([ $s = 1 ] && echo "" || echo "@${s}x")
  shot launch.svg "LaunchStar.imageset/launch-star$suffix.png" $((64 * s)) yes
done
rm -rf "$TMP"
sips -g hasAlpha AppIcon.appiconset/*.png | grep -c 'hasAlpha: no' | xargs -I{} echo "{} of 3 icons opaque"
