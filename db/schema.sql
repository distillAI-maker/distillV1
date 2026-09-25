-- Signups from the landing page. Run this once in your database's SQL editor.

create table if not exists signups (
  id          bigserial primary key,
  email       text        not null,
  wearable    text,                       -- Oura, WHOOP, Apple Watch, Garmin, Fitbit, Other, or null
  source      text,                       -- which form: "popup" or "final"
  user_agent  text,
  created_at  timestamptz not null default now()
);

-- Emails are lower-cased and trimmed before insert, so one row per address.
create unique index if not exists signups_email_key on signups (email);

-- Handy view of the founding list, newest first:
--   select email, wearable, source, created_at from signups order by created_at desc;
