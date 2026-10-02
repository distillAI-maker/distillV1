-- Apply to Supabase Postgres. Does not alter the existing landing-page signup policies.
create table public.wearable_accounts (
  user_id uuid primary key references auth.users(id) on delete cascade,
  deleting boolean not null default false
);
create table public.wearable_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wearable_accounts(user_id) on delete cascade,
  provider text not null check (provider in ('oura','whoop','fitbit')),
  token_envelope text not null, backfill_before date, last_synced_at timestamptz,
  next_sync_at timestamptz not null default now(), lease uuid, lease_until timestamptz,
  error_code text, disabled boolean not null default false
);
create unique index wearable_connection_owner on public.wearable_connections(user_id, provider);
create index wearable_sync_due on public.wearable_connections(next_sync_at);
create table public.wearable_oauth_states (
  hash text primary key, user_id uuid not null references public.wearable_accounts(user_id) on delete cascade,
  provider text not null, verifier_envelope text not null, expires_at timestamptz not null
);
create table public.wearable_raw_payloads (
  id uuid primary key, user_id uuid not null references public.wearable_accounts(user_id) on delete cascade,
  source text not null, kind text not null, source_id text not null, payload jsonb not null
);
create unique index wearable_raw_owner on public.wearable_raw_payloads(user_id, source, kind, source_id);
create table public.wearable_nights (
  user_id uuid not null references public.wearable_accounts(user_id) on delete cascade,
  source text not null, sleep_date date not null, record jsonb not null,
  primary key (user_id, source, sleep_date)
);
create table public.wearable_events (
  user_id uuid not null references public.wearable_accounts(user_id) on delete cascade,
  source text not null, kind text not null, source_id text not null, record jsonb not null,
  primary key (user_id, source, kind, source_id)
);
create table public.wearable_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.wearable_accounts(user_id) on delete cascade,
  source text not null check (source in ('apple_export','csv')), source_name text, path text not null,
  status text not null default 'uploading' check (status in ('uploading','queued','running','done','failed')),
  lease uuid, lease_until timestamptz, error_code text
);
create unique index wearable_import_path on public.wearable_imports(path);

-- Tokens, raw health data and worker state are server-only. Even authenticated clients
-- use the API, which derives user_id from Supabase Auth rather than a request body.
alter table public.wearable_accounts enable row level security;
alter table public.wearable_connections enable row level security;
alter table public.wearable_oauth_states enable row level security;
alter table public.wearable_raw_payloads enable row level security;
alter table public.wearable_nights enable row level security;
alter table public.wearable_events enable row level security;
alter table public.wearable_imports enable row level security;
revoke all on public.wearable_accounts, public.wearable_connections, public.wearable_oauth_states,
  public.wearable_raw_payloads, public.wearable_nights, public.wearable_events, public.wearable_imports from anon, authenticated;

-- Authenticated direct uploads bypass Vercel's body limit. No signed upload URLs:
-- those could remain usable after account deletion. Upload authorization consults
-- a live account and a pre-created import, and never permits overwrite.
insert into storage.buckets (id, name, public, file_size_limit)
values ('wearable-imports', 'wearable-imports', false, 268435456)
on conflict (id) do nothing;

create function public.can_upload_wearable(object_name text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.wearable_imports i
    join public.wearable_accounts a on a.user_id = i.user_id
    where i.path = object_name and i.user_id = auth.uid()
      and i.status = 'uploading' and not a.deleting
  );
$$;
revoke all on function public.can_upload_wearable(text) from public;
grant execute on function public.can_upload_wearable(text) to authenticated;
create policy wearable_import_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'wearable-imports' and public.can_upload_wearable(name));
