# Distill

Landing page for Distill, the wellness app that tests your habit stack on your own wearable data and tells you what to keep and what to stop paying for.

The site is one static file. Signups go straight into a Supabase table. Hosting is Cloudflare Pages, which is free for commercial use and deploys from this repo on every push.

## What's in here

```
public/index.html     the website: hand-written CSS, no framework, no build step
supabase/schema.sql   the signups table and its security rules
docs/                 copy, research, routing table, design board, domain research
```

## Look at it on your laptop

```bash
python3 -m http.server 3000 -d public
```

Then open http://localhost:3000. The form only saves once Supabase is connected (step 2 below).

## Going live, in three parts

### 1. Host the page (Cloudflare Pages, free)

1. Sign up at dash.cloudflare.com.
2. Go to **Workers & Pages > Create > Pages > Connect to Git** and pick `distillAI-maker/distillV1`.
3. Settings: framework preset **None**, build command **empty**, build output directory **`public`**. Click **Save and Deploy**.
4. In about a minute the site is live at `distillv1.pages.dev` (or similar). Every push to `main` redeploys it.

No GitHub yet? **Workers & Pages > Create > Pages > Upload assets** lets you drag the `public` folder in by hand.

### 2. Store the signups (Supabase, free)

1. Sign up at supabase.com and create a project. Save the database password somewhere safe; you won't need it for the site.
2. Open **SQL Editor > New query**, paste all of `supabase/schema.sql`, and run it.
3. Open **Project Settings > API**. Copy the **Project URL** and the **anon public** key.
4. Paste both into the top of `public/index.html`, in the `window.DISTILL` block. Commit and push (or re-upload). That's it: the form now saves.
5. Test with your own email, then look at **Table Editor > signups**. That is the founding list.

The anon key is designed to be public. The SQL in step 2 only lets it add rows, never read them.

One thing to know: Supabase pauses free projects after about a week with no activity, and the form fails while it's paused. Any signup or a dashboard visit counts as activity, and a paused project restores with one click. The Pro plan ($25 a month) never pauses.

### 3. Point a domain at it

See `docs/Domain-Research.md` for which names are free and what they cost.

1. Buy the domain at **Cloudflare > Domain Registration** (at-cost pricing, privacy included). If Cloudflare doesn't sell that ending, buy at Porkbun instead.
2. In the Pages project, open **Custom domains > Set up a custom domain**, type the name, and confirm. Cloudflare adds the DNS record itself when the domain is in the same account. Bought elsewhere? Add the CNAME it shows you at that registrar.
3. Wait a few minutes for the certificate. Done: the site answers at your domain over HTTPS.

Bonus: **Email Routing** in the same Cloudflare dashboard forwards `hello@yourdomain` to a Gmail inbox for free.

## How the form works

Both forms (popup and bottom of page) post one row to the `signups` table through Supabase's REST API. Duplicates are treated as success, so nobody sees an error for signing up twice. A hidden field catches simple bots. Addresses are lower-cased in the database itself.

## Editing the page

Everything is in `public/index.html`. The copy is documented section by section in `docs/Distill-LP-Copy-v2.md`, the design in `docs/design-directions.html`. The wordmark is switched with one class on `<body>`: `wm-w4` (Italiana, current), `wm-w1` (Cormorant caps) or `wm-w8` (Tenor Sans).

## Next steps

- Send a confirmation email on signup. Supabase Edge Functions plus Resend (free tier) is the usual pairing, and it also moves validation off the browser.
- Before paid traffic: get three real reviews from free beta users and add them to the page. The plan is at the end of `docs/Distill-LP-Copy-v2.md`.
- The wearable connection, the daily tap and the experiment engine come next. Supabase Auth and Postgres are already in place for them.
