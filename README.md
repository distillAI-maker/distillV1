# Distill

Landing page and signup backend for Distill, the wellness app that tests your habit stack on your own wearable data and tells you what to keep and what to stop paying for.

## What's in here

```
public/          the website (one file, hand-written CSS, no framework)
api/signup.py    the backend: stores signups from the form
db/schema.sql    the one table the backend writes to
dev/server.py    runs the site and the backend on your laptop
docs/            copy, research, the routing table, and the design options board
```

## Run it on your laptop

You need Python 3 (already on every Mac). Nothing to install.

```bash
python3 dev/server.py
```

Open http://localhost:3000. Fill in the form. Each signup is appended to `dev/signups.jsonl`, which git ignores.

## Put it on the internet

The site needs a server to store signups, so GitHub Pages alone won't do (it only serves static files). Vercel hosts the page and runs `api/signup.py` for free, and redeploys every time you push to GitHub.

1. Go to vercel.com, sign in with GitHub, and click **Add New > Project**. Import `distillAI-maker/distillV1`. Leave every setting at its default and click **Deploy**. The page will be live in about a minute, but the form will fail until step 2.
2. In the Vercel project, open **Storage > Create Database > Neon** (free plan). Accept the defaults. This creates the `DATABASE_URL` environment variable for you.
3. Open the Neon database, go to its **SQL Editor**, paste the contents of `db/schema.sql`, and run it.
4. Back in Vercel, open **Deployments** and click **Redeploy** on the latest one so the function picks up `DATABASE_URL`.
5. Test the live form with your own email. Then in Neon's **Tables** view (or the SQL editor) run:

```sql
select email, wearable, source, created_at from signups order by created_at desc;
```

That's the founding list. Every push to `main` redeploys automatically from now on.

Prefer Supabase? Create a project, copy the **Transaction pooler** connection string from Project Settings > Database, add it as `DATABASE_URL` in Vercel's Environment Variables, run `db/schema.sql` in Supabase's SQL editor, and redeploy.

## How the form works

The page posts JSON to `/api/signup`:

```json
{"email": "you@example.com", "wearable": "Oura", "source": "popup"}
```

The backend lower-cases and checks the email, keeps one row per address, ignores anything that fills the hidden `website` field (a bot trap), and answers `{"ok": true}`. On failure it answers `{"ok": false, "error": "..."}` and the page shows that message under the form.

## Editing the page

Everything is in `public/index.html`. The copy is documented section by section in `docs/Distill-LP-Copy-v2.md`, and the design choices in `docs/design-directions.html`. The wordmark is switched with one class on `<body>`: `wm-w4` (Italiana, current), `wm-w1` (Cormorant caps) or `wm-w8` (Tenor Sans).

## Next steps

- Send a confirmation email on signup (Resend has a free tier; call it from `api/signup.py` after the insert).
- Add a small `/api/export` protected by a secret so the team can download the list as CSV.
- Before paid traffic: get three real reviews from free beta users and add them to the page. See the plan at the end of `docs/Distill-LP-Copy-v2.md`.
- The wearable connection, the daily tap, and the experiment engine are the next backend pieces. Keep them in `api/` so they deploy the same way.
