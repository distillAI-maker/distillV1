-- Launch funnel: which steps people reach (started, saw their number, joined, wrote a note...).
-- Steps and small counts only, never what anyone writes and never an email. `device` is a random
-- id kept on the phone, not a person. Written by the server (apps/web/app/api/event/route.ts).
create table public.app_events (
  id bigint generated always as identity primary key,
  device text not null,
  event text not null,
  props jsonb not null default '{}'::jsonb,
  source text,
  at timestamptz not null default now()
);
create index app_events_event_at on public.app_events (event, at);
create index app_events_source on public.app_events (source);
alter table public.app_events enable row level security;
revoke all on public.app_events from anon, authenticated;
