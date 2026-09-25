-- Distill signups table. Run this once in Supabase > SQL Editor > New query.
-- It creates the table, cleans up addresses on the way in, and locks the
-- public key down to "insert only": visitors can add themselves to the list
-- and nothing else. (The publishable key from the dashboard acts as the
-- "anon" role below.) The list itself is only visible in the dashboard.

create table if not exists public.signups (
  id          bigint generated always as identity primary key,
  email       text        not null,
  wearable    text,                              -- Oura, WHOOP, Apple Watch, Garmin, Fitbit, Other
  source      text,                              -- which form: "popup" or "final"
  user_agent  text,
  created_at  timestamptz not null default now(),
  constraint signups_email_format   check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  constraint signups_email_length   check (char_length(email) <= 254),
  constraint signups_wearable_known check (wearable is null or wearable in ('Oura','WHOOP','Apple Watch','Garmin','Fitbit','Other')),
  constraint signups_source_short   check (source is null or char_length(source) <= 40),
  constraint signups_ua_short       check (user_agent is null or char_length(user_agent) <= 400)
);

-- One row per address.
create unique index if not exists signups_email_key on public.signups (email);

-- Lower-case and trim every address before it is stored.
create or replace function public.signups_normalize()
returns trigger
language plpgsql
as $$
begin
  new.email := lower(btrim(new.email));
  return new;
end;
$$;

drop trigger if exists signups_normalize on public.signups;
create trigger signups_normalize
  before insert or update on public.signups
  for each row execute function public.signups_normalize();

-- Row Level Security: the public key may insert, and that is all.
alter table public.signups enable row level security;

drop policy if exists "anyone can sign up" on public.signups;
create policy "anyone can sign up"
  on public.signups
  for insert
  to anon
  with check (true);

-- No select, update or delete policies on purpose. Reading the list happens in
-- the Supabase dashboard (Table Editor) or with the service key on a server.

revoke all on public.signups from anon;
grant insert on public.signups to anon;
grant usage, select on sequence public.signups_id_seq to anon;

-- Later, to read the founding list, run this in the SQL editor:
--   select email, wearable, source, created_at from public.signups order by created_at desc;
