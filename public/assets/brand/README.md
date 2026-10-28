# Distill brand marks

Preview all of it: `preview.html` (or `preview.png`).

| File | Use |
| --- | --- |
| `distill-logo-light.svg` / `-dark.svg` | Star + wordmark. Light = ink, for light grounds. Dark = ground, for dark grounds. |
| `distill-mark-light.svg` / `-dark.svg` | The star alone. |
| `profile-*.svg`, `png/profile-*-400.png`, `-1080.png` | Social profile pictures (Instagram, X, TikTok, LinkedIn). Square and full-bleed; the star sits inside the circle crop. Upload the 1080 PNG. |
| `png/distill-logo-*.png`, `png/distill-mark-*.png` | Transparent PNGs at 4x. |

- The star is the Figma eight-point chisel star, the same path as `apps/web/components/d-star.tsx`. Its centre dot is drawn out into an arrow up the north ray: the direction we want your life to go in. Profile pictures use a heavier stroke so it holds at 40px.
- The wordmark is Newsreader 500, outlined to paths, so the files need no font.
- Rebuild: `python3 scripts/build_brand_assets.py`, then `scripts/export_brand_pngs.sh` (needs Google Chrome).
