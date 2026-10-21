-- The team's email list in Google Sheets (docs/EMAIL-SHEET.md). The sheet's script calls
-- distill_email_list with a long random key that lives only in the script's private properties;
-- the database keeps just its SHA-256, so nothing here can be used to read the list.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.sheet_keys (
  key_hash   text primary key check (key_hash ~ '^[0-9a-f]{64}$'),
  label      text not null default 'google-sheet',
  created_at timestamptz not null default now()
);

-- Everyone who left an email: the website's waitlist, and accounts made in the app.
create or replace function public.distill_email_list(p_key text)
returns table (
  email           text,
  kind            text,
  joined_at       timestamptz,
  wearable        text,
  form            text,
  confirmed_at    timestamptz,
  last_sign_in_at timestamptz,
  onboarding      text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_key is null or length(p_key) < 48 or not exists (
    select 1 from private.sheet_keys k
    where k.key_hash = encode(extensions.digest(p_key, 'sha256'), 'hex')
  ) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  return query
    select s.email, 'waitlist'::text, s.created_at, s.wearable, s.source,
           null::timestamptz, null::timestamptz, null::text
      from public.signups s
    union all
    select u.email::text, 'app account'::text, u.created_at, null::text, null::text,
           u.email_confirmed_at, u.last_sign_in_at, j.progress->>'step'
      from auth.users u
      left join public.app_journeys j on j.user_id = u.id
     where u.email is not null
    order by 3 desc;
end;
$$;

revoke all on function public.distill_email_list(text) from public;
grant execute on function public.distill_email_list(text) to anon;
