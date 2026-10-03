-- Phase 8: saved onboarding progress and daily taps. Owner-only through row-level security;
-- every row is keyed by the Supabase Auth user and cascades when the user is deleted, so
-- Phase 2's account deletion removes these too. Experiments, pre-registration records and
-- verdicts are not stored here; they belong to Phases 4 to 7.

create table public.app_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data_source text check (data_source in ('demo','oura','whoop','fitbit','apple_export')),
  onboarding_step text not null default 'connect'
    check (onboarding_step in ('connect','stack','goals','questions','day-one','done')),
  goals text[] not null default '{}',
  reduced_motion boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.stack_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.app_profiles(user_id) on delete cascade,
  item_key text,                      -- catalog key; null for something not listed
  custom_name text check (custom_name is null or char_length(custom_name) <= 120),
  monthly_cost numeric(8,2) not null default 0 check (monthly_cost >= 0),
  origin text check (origin is null or origin in ('doctor','blood test','friend','podcast','online','other')),
  answers jsonb not null default '{}'::jsonb,
  status text not null default 'listed'
    check (status in ('listed','cut','kept','testing','protected')),
  status_changed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  constraint stack_item_named check (item_key is not null or custom_name is not null)
);
create unique index stack_items_owner_key on public.stack_items(user_id, item_key) where item_key is not null;
create index stack_items_owner on public.stack_items(user_id, position);

create table public.daily_taps (
  user_id uuid not null references public.app_profiles(user_id) on delete cascade,
  experiment_id text not null,
  night date not null,
  value text not null check (value in ('did','didnt','unknown')),
  excluded_reason text check (excluded_reason is null or char_length(excluded_reason) <= 60),
  created_at timestamptz not null default now(),
  primary key (user_id, experiment_id, night)
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
create trigger app_profiles_touch before update on public.app_profiles
  for each row execute function public.touch_updated_at();

alter table public.app_profiles enable row level security;
alter table public.stack_items enable row level security;
alter table public.daily_taps enable row level security;

create policy app_profiles_owner on public.app_profiles
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy stack_items_owner on public.stack_items
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy daily_taps_owner on public.daily_taps
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

revoke all on public.app_profiles, public.stack_items, public.daily_taps from anon;
grant select, insert, update, delete on public.app_profiles, public.stack_items, public.daily_taps to authenticated;
