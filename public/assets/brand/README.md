# Distill brand marks

Preview all of it: `preview.html` (or `preview.png`).

| File | Use |
| --- | --- |
| `distill-logo-light.svg` / `-dark.svg` | Star + wordmark. Light = ink, for light grounds. Dark = ground, for dark grounds. |
| `distill-mark-light.svg` / `-dark.svg` | The star alone. |
| `profile-*.svg`, `png/profile-*-400.png`, `-1080.png` | Social profile pictures (Instagram, X, TikTok, LinkedIn). Square and full-bleed; the star sits inside the circle crop. Upload the 1080 PNG. |
| `png/distill-logo-*.png`, `png/distill-mark-*.png` | Transparent PNGs at 4x. |

- The mark is **Star in the noise**: the Figma eight-point chisel star (same path as `apps/web/components/d-star.tsx`), a little smaller, with specks of noise left outside it and one persimmon dot inside: the noise distilled down to one choice. Profile pictures use a heavier stroke so it holds at 40px.
- The idea behind it (16 dots, then 8, then 4, then one) suits motion: a loader or a reveal, not the logo.
- The wordmark is Newsreader 500, outlined to paths, so the files need no font.
- Rebuild: `python3 scripts/build_brand_assets.py`, then `scripts/export_brand_pngs.sh` (needs Google Chrome).
