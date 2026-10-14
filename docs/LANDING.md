# The landing page

The marketing site lives in `public/` and is served by Vercel as-is: no framework, no build step. It is the white, black and gold page with the phone that tells the product's story as you scroll (October 2026). The version before it is kept at `docs/archive/landing-v3-glass.html`.

## What lives where

| Path | What it is |
|---|---|
| `public/index.html` | All the page's words and structure |
| `public/assets/css/site.css` | Every style, with the color and motion tokens at the top |
| `public/assets/js/` | One module per moment: `story.js` (the phone and its four screens), `try.js` (what's in your list), `join.js` (the waitlist form), `reels.js` (rolling numbers), `main.js`, `util.js` |
| `public/assets/data/stack.json` | The 210 Routing Table items the "What's in your list?" chips use. Generated, don't edit by hand |
| `public/assets/fonts/` | Switzer, self-hosted |
| `public/vendor/` | GSAP 3.15 (ScrollTrigger, Flip, SplitText, CustomEase) and Lenis 1.3, copied in so nothing loads from a CDN |
| `scripts/build_landing_data.py` | Rebuilds `stack.json` from `data/Routing-Table_V3.xlsx` (the same workbook the app catalog uses) |
| `docs/landing/BUILD-PROMPT.md` | The prompt the page was built from, with its revisions |
| `docs/landing/PRODUCT.md`, `docs/landing/DESIGN.md` | Product facts and the design system the page follows |
| `docs/landing/MOTION-PLAN.md` | The motion system |
| `docs/landing/research/` | The reference teardowns the direction came from |
| `supabase/schema.sql` | The signups table and its security rules |
| `vercel.json` | Tells Vercel to serve the public folder as-is; the install and build commands stay empty so the app workspace never builds for this project |

## Look at it on your laptop

```bash
python3 -m http.server 3000 -d public
```

Then open http://localhost:3000. Add `?motion=off` to see every animated state at rest.

## Common changes

- **Change copy:** edit `public/index.html`. Keep the rules in `docs/landing/PRODUCT.md` (no red, no dashes, no "should").
- **Routing Table changed:** replace `data/Routing-Table_V3.xlsx`, run `python3 scripts/build_landing_data.py`, commit the new `stack.json`.
- **The example list in the phone** (21 items, $1,428 a month) is written by hand in `index.html` from the workbook's Worked Example sheet.

## The waitlist

Both forms (hero and the closing section) post one row to the Supabase table `signups` through Supabase's REST API, using the publishable key at the top of `public/assets/js/join.js`. The key is meant to be public: the table only allows inserts for it, and the list is only readable from the dashboard. Duplicates are treated as success, so nobody sees an error for signing up twice. The `source` column says which form it was (`site-hero` or `site-close`).

Read the list in Supabase under Table Editor, or with:

```sql
select email, wearable, source, created_at from public.signups order by created_at desc;
```

## Deploys

- Live: https://distill-v1-tau.vercel.app (Vercel project `distill-v1`, the company account)
- Every push to `main` deploys in about a minute. Vercel Hobby only builds commits authored by the account owner, so this clone's git identity is `distillAI-maker`.

Supabase pauses free projects after about a week with no activity, and the form fails while paused. A signup or a dashboard visit counts as activity, and a paused project restores with one click.
