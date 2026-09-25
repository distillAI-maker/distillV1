# Distill

Landing page for Distill, the wellness app that tests your habit stack on your own wearable data and tells you what to keep and what to stop paying for.

The site is one static file. Signups go straight into a Supabase table. Hosting is Vercel's free plan, which deploys from this repo on every push. Everything here is free; only a custom domain costs money (about $10 a year), and that is optional.

## What's in here

```
public/index.html     the website: hand-written CSS, no framework, no build step
supabase/schema.sql   the signups table and its security rules
docs/                 the setup guide, copy, research, routing table, design board, domain research
vercel.json           tells Vercel to serve the public folder as-is
```

## Look at it on your laptop

```bash
python3 -m http.server 3000 -d public
```

Then open http://localhost:3000. The form only saves once Supabase is connected (step 2 below).

## Going live

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

## Editing the page

Everything is in `public/index.html`. The copy is documented section by section in `docs/Distill-LP-Copy-v2.md`, the design in `docs/design-directions.html`. The wordmark is switched with one class on `<body>`: `wm-w4` (Italiana, current), `wm-w1` (Cormorant caps) or `wm-w8` (Tenor Sans).

## Next steps

- Send a confirmation email on signup. Supabase Edge Functions plus Resend (free tier) is the usual pairing, and it also moves validation off the browser.
- Before paid traffic: get three real reviews from free beta users and add them to the page. The plan is at the end of `docs/Distill-LP-Copy-v2.md`.
- The wearable connection, the daily tap and the experiment engine come next. Supabase Auth and Postgres are already in place for them.
