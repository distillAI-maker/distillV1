# Distill

Landing page for Distill, the wellness app that tests your habit stack on your own wearable data and tells you what to keep and what to stop paying for.

The site is one static file. Signups go straight into a Supabase table. Hosting is Vercel's free plan, which deploys from this repo on every push. Everything here is free; only a custom domain costs money (about $10 a year), and that is optional.

## Where things stand

- **Live:** https://distill-v1-tau.vercel.app, serving version 3 of the page (October 2026).
- **Connected:** this repo deploys to Vercel on every push to `main`, and the sign-up forms save to the Supabase `signups` table. Both are set up and working; nothing in the "How it was set up" section below needs doing again.
- **To change the site:** edit `public/index.html`, commit, and push to `main`. Vercel publishes it in about a minute. For bigger changes, work on a branch first and merge it into `main` when it is ready.
- **To undo a change:** revert the commit and push; Vercel publishes the previous version.

## What's in here

```
public/index.html     the website: hand-written CSS, no framework, no build step
public/routing.json   the routing table as data, read by the "What would Distill do with it?" widget (fetched when the widget is close to the screen, not on page load)
scripts/build_routing.py  rebuilds routing.json from docs/Routing-Table.xlsx (python3 scripts/build_routing.py)
supabase/schema.sql   the signups table and its security rules
docs/                 the setup guide, copy, research, routing table, design board, domain research
vercel.json           tells Vercel to serve the public folder as-is
```

## Look at it on your laptop

```bash
python3 -m http.server 3000 -d public
```

Then open http://localhost:3000. The form only saves once Supabase is connected (step 2 below).

## How it was set up (for reference)

The full beginner walkthrough, with every click, is `docs/Setup-Guide.html` (open it in a browser). The short version:

### 1. GitHub

The code lives in this repository, owned by the `distillAI-maker` account. Keep the repository private (Settings > Danger Zone > Change visibility). To let this Mac push, add the personal account `ivannadil` as a collaborator (Settings > Collaborators > Add people) and accept the invitation from that account.

### 2. Vercel (hosting, free)

1. Sign in to GitHub as `distillAI-maker`, then sign up at vercel.com with **Continue with GitHub**. Vercel only lets the repository owner import it, so the accounts must match.
2. **Add New > Project > Import** `distillV1`. Framework preset **Other**, leave the build settings alone (`vercel.json` already points Vercel at the `public` folder). Click **Deploy**.
3. About a minute later the site is live at `distill.vercel.app` (or a close variant). Every push to `main` redeploys it.

### 3. Supabase (signups, free)

1. Create a project at supabase.com. Save the database password somewhere safe.
2. **SQL Editor > New query**: paste all of `supabase/schema.sql` and run it.
3. **Settings > API Keys**: copy the **Project URL** and the **Publishable key**.
4. Paste both into the `window.DISTILL` block at the top of `public/index.html`, commit, push. The form now saves.
5. Test with your own email, then look at **Table Editor > signups**. That is the founding list.

Supabase pauses free projects after about a week with no activity, and the form fails while paused. A signup or a dashboard visit counts as activity, and a paused project restores with one click.

### 4. A domain, later

The `vercel.app` address is free and has no "claude" in it. A custom domain costs about $10 a year; `docs/Domain-Research.md` has the shortlist. Add it under the Vercel project's **Settings > Domains** and follow the DNS instructions it shows.

## How the form works

Both forms (popup and bottom of page) post one row to the `signups` table through Supabase's REST API, using the publishable key. Duplicates are treated as success, so nobody sees an error for signing up twice. A hidden field catches simple bots. Addresses are lower-cased in the database itself.

## The router widget

The section under the hero is the real day-one router. It reads `public/routing.json`, which is generated from the spreadsheet: every item's tier, the number a wearable would watch, the expected effect against a normal night-to-night swing, what the studies found, the safety note, and the sentence the person reads on day one. The follow-up questions (dose and form, timing, visits, last used, still paying) are encoded as data in `scripts/build_routing.py`, in the `RULES` table, because the sheet writes them as prose. When the spreadsheet changes, run the script and commit the new JSON.

The order of checks matches the sheet's "Start Here" tab: Protected first, then anything settled without a test (dose, form, not being used), then the goal, then the 0.8 effect gate, then slow items to the queue.

The engine lives in the `route()` function and decides the tier. The `render()` function under it only decides how the answer is worded and laid out for a visitor (the plain verdict line, the "how big is the likely change" meter, and the details that open on request). Change wording in `render()`; change logic in the spreadsheet and the script.

## Editing the page

Everything is in `public/index.html`. This is version 3 of the page (October 2026). The research it was built from, and a table of what changed and why, is in `docs/Design-Research.md`. Part 5 of that file lists every animated or decorative element on the page, what it is for, and where to find it if it needs turning off. The current copy, with every headline, sub-headline, value prop and button variation that was written, is in `docs/Distill-LP-Copy-v3.md`. The earlier copy is documented section by section in `docs/Distill-LP-Copy-v2.md`, the design options in `docs/design-directions.html`, and the previous page is kept at `docs/archive/landing-v2-drop-hero.html`.

The page order follows the questions a visitor asks, with the most visual sections first: hero, how it works (with the verdict explorer), the try-it widget (with a stack you can build), the scoreboard, then the pain letter, eight value props, the four promises, the offer, questions, and the sign-up panel. Each section is one `<section>` block in `<main>`, so the order can be changed by moving a block; sections with the class `band` get the tinted background. The hero headline is the founder's sentence with a timeframe and a proof element added; the nine alternatives are in the v3 copy document.

The wordmark is switched with one class on `<body>`: `wm-w4` (Italiana, current), `wm-w1` (Cormorant caps) or `wm-w8` (Tenor Sans).

## Next steps

- Put one real sign-up through the live form and check it lands in the `signups` table. The version 3 form was tested with the network call stubbed, not with a real submission.
- Decide three things the page does not say yet, listed in part 4 of `docs/Design-Research.md`: a privacy line (your data is never sold), how to cancel, and real reviews.
- Check the claim "the only app that runs one-habit, on/off experiments on your own wearable data" before paid traffic.
- Send a confirmation email on signup. Supabase Edge Functions plus Resend (free tier) is the usual pairing, and it also moves validation off the browser.
- Before paid traffic: get three real reviews from free beta users and add them to the page. The plan is at the end of `docs/Distill-LP-Copy-v2.md`.
- The wearable connection, the daily tap and the experiment engine come next. Supabase Auth and Postgres are already in place for them.
