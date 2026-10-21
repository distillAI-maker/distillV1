# The email list in Google Sheets

One Google Sheet holds every email Distill has: the website's waitlist (`signups`) and every account made in the app (`auth.users`, with whether they confirmed, signed in and how far they got in onboarding). It refreshes itself every 15 minutes.

**How it stays private.** The sheet's script asks Supabase through `distill_email_list(key)` (`supabase/migrations/20261022000001_email_sheet.sql`). That function answers only to a long random key that lives in the script's private properties; Supabase stores just the key's SHA-256. The website's public key alone can't read the list. Share the sheet only with the team: anyone with edit access to the sheet can open its script.

## Set it up (about five minutes, once)

1. **In Supabase**, open SQL Editor → New query, paste the whole of `supabase/migrations/20261022000001_email_sheet.sql`, and Run.
2. **In Google**, signed in as disttilai@gmail.com, create a sheet (sheets.new) and name it "Distill emails".
3. **Extensions → Apps Script.** Delete what's there, paste `scripts/email-sheet/Code.gs`, and Save.
4. Back in the sheet, reload. A **Distill** menu appears. Choose **Distill → Set up (once)** and allow access when Google asks (the script needs to reach Supabase and run on a timer). A box shows a 64-character code.
5. **Register the code in Supabase:** SQL Editor, run (with your code in the quotes):

   ```sql
   insert into private.sheet_keys (key_hash) values ('PASTE-THE-CODE-HERE');
   ```

   The code is a fingerprint of the key, not the key, so it's safe to paste anywhere.
6. Choose **Distill → Refresh now.** The Emails tab fills in, and cell J1 says when it last updated.

## Later

- **Turn it off:** in Supabase, `delete from private.sheet_keys;`. The sheet stops updating at once.
- **A new sheet:** run Set up there and register its code; each sheet has its own key.
- **Not updating?** Cell J1 says why. "Not registered" means step 5 is missing or used an old code.
