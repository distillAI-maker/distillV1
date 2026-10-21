-- The engine (docs/ENGINE.md). app_journeys.progress stays the record of what the person entered;
-- these five tables hold what the engine produces from it: who they are, their Ritual and every
-- version of it, the companion thread, the decisions it proposed and how they answered, and an
-- event log phase 2 can learn from. Server-only, like app_journeys: RLS on, nothing granted to
-- anon or authenticated; the API reads and writes them with the user id taken from Supabase Auth.
-- Deleting the account cascades through all of them.

create table public.person_models (
  user_id uuid primary key references auth.users(id) on delete cascade,
  version integer not null default 1 check (version > 0),
  model jsonb not null,
  built_from text not null check (built_from in ('progress-v1', 'engine')),
  updated_at timestamptz not null default now()
);

-- A base version is the recurring week from scope_date on; a day version is that date's edits
-- (ops) on whichever base week is in force that day, so later base changes still reach it.
create table public.ritual_versions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version integer not null check (version > 0),
  parent_id uuid references public.ritual_versions(id) on delete set null,
  scope text not null check (scope in ('base', 'day')),
  scope_date date not null,
  parts jsonb not null default '[]'::jsonb,
  ops jsonb not null default '[]'::jsonb,
  changes jsonb not null default '[]'::jsonb,
  trigger text not null check (trigger in ('onboarding', 'message', 'plan', 'night', 'slip', 'edit', 'decision', 'refresh')),
  cause_event bigint,
  status text not null check (status in ('proposed', 'accepted', 'undone', 'superseded')),
  reply text check (reply is null or char_length(reply) <= 600),
  engine jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, version),
  check (scope = 'base' or parts = '[]'::jsonb)
);
create index ritual_current on public.ritual_versions (user_id, scope, scope_date, version desc)
  where status = 'accepted';

create table public.context_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('person', 'companion')),
  text text not null check (char_length(text) between 1 and 2000),
  -- What the message reader made of a person's message, for the record and for learning.
  trigger jsonb,
  ritual_version_id uuid references public.ritual_versions(id) on delete set null,
  at timestamptz not null default now()
);
create index context_messages_owner on public.context_messages (user_id, at desc);

create table public.decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  -- progress.items[].id (a string today, not a foreign key); null only for explore.
  stack_item_id text,
  item_key text,
  kind text not null check (kind in ('clear', 'keep', 'curate', 'explore', 'refer')),
  reason text not null,
  line text not null check (char_length(line) <= 600),
  evidence_tier text check (evidence_tier in ('A', 'B', 'C', 'D', 'N', 'U')),
  money numeric(8, 2) not null default 0 check (money >= 0),
  status text not null default 'proposed' check (status in ('proposed', 'yes', 'not-now', 'theirs', 'withdrawn')),
  engine jsonb not null,
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  check ((kind = 'explore') or stack_item_id is not null)
);
create unique index decisions_open on public.decisions (user_id, coalesce(stack_item_id, ''), kind)
  where status = 'proposed';
create index decisions_owner on public.decisions (user_id, created_at desc);

create table public.engine_events (
  id bigint generated always as identity primary key,
  -- Null for a signed-out device; `device` is the same random id app_events uses.
  user_id uuid references auth.users(id) on delete cascade,
  device text,
  kind text not null check (char_length(kind) <= 60),
  payload jsonb not null default '{}'::jsonb,
  engine jsonb,
  model text,
  tokens_in integer,
  tokens_out integer,
  cache_read integer,
  cost_usd numeric(8, 5),
  latency_ms integer,
  at timestamptz not null default now()
);
create index engine_events_owner on public.engine_events (user_id, at);
create index engine_events_kind on public.engine_events (kind, at);

alter table public.person_models enable row level security;
alter table public.ritual_versions enable row level security;
alter table public.context_messages enable row level security;
alter table public.decisions enable row level security;
alter table public.engine_events enable row level security;
revoke all on public.person_models, public.ritual_versions, public.context_messages,
  public.decisions, public.engine_events from anon, authenticated;

-- What to watch with the Founding 100 (build plan, section 7). One view per metric.
create view public.engine_metric_first_ritual with (security_invoker = true) as
  select date_trunc('week', first.created_at) as week,
         count(*) as members,
         count(*) filter (where first.status = 'accepted' and accepted.at::date = first.created_at::date) as accepted_day_one
  from (select distinct on (user_id) user_id, created_at, status from public.ritual_versions
        where trigger = 'onboarding' order by user_id, version) first
  left join lateral (select min(at) as at from public.engine_events e
                     where e.user_id = first.user_id and e.kind = 'ritual.accepted') accepted on true
  group by 1;

create view public.engine_metric_weekly_active with (security_invoker = true) as
  select date_trunc('week', at) as week, count(distinct user_id) as active_members
  from public.engine_events where user_id is not null group by 1;

create view public.engine_metric_messages with (security_invoker = true) as
  select date_trunc('week', at) as week, count(*) as messages, count(distinct user_id) as members
  from public.context_messages where role = 'person' group by 1;

create view public.engine_metric_reshapes_kept with (security_invoker = true) as
  select date_trunc('week', created_at) as week,
         count(*) as reshapes,
         count(*) filter (where status <> 'undone') as kept
  from public.ritual_versions where trigger in ('message', 'plan', 'night', 'slip') group by 1;

create view public.engine_metric_clears with (security_invoker = true) as
  select date_trunc('week', created_at) as week,
         count(*) filter (where kind = 'clear') as proposed,
         count(*) filter (where kind = 'clear' and status = 'yes') as accepted,
         coalesce(sum(money) filter (where kind = 'clear' and status = 'yes'), 0) as money_back_monthly,
         count(*) filter (where status = 'theirs') as this_is_mine
  from public.decisions group by 1;

create view public.engine_metric_cost with (security_invoker = true) as
  select date_trunc('day', at) as day,
         count(distinct user_id) as members,
         coalesce(sum(cost_usd), 0) as cost_usd,
         percentile_disc(0.95) within group (order by latency_ms) filter (where kind = 'llm.call' and payload->>'step' = 'reshape') as reshape_p95_ms
  from public.engine_events group by 1;

create view public.engine_metric_know_yourself with (security_invoker = true) as
  select date_trunc('month', at) as month,
         count(*) as answers,
         count(*) filter (where payload->>'answer' = 'yes') as yes
  from public.engine_events where kind = 'survey.answered' group by 1;

revoke all on public.engine_metric_first_ritual, public.engine_metric_weekly_active,
  public.engine_metric_messages, public.engine_metric_reshapes_kept, public.engine_metric_clears,
  public.engine_metric_cost, public.engine_metric_know_yourself from anon, authenticated;
