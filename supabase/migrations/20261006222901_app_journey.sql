-- Complete onboarding state and immutable result cards. Version matches the hosted migration.
create table public.app_journeys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  progress jsonb not null,
  baseline_requested_date date,
  demo_through date,
  updated_at timestamptz not null default now()
);
alter table public.app_journeys enable row level security;
revoke all on public.app_journeys from anon, authenticated;

alter table public.experiments add column app_context jsonb;
create table public.experiment_results (
  experiment_id uuid primary key references public.experiments(id) on delete cascade,
  verdict jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.experiment_results enable row level security;
revoke all on public.experiment_results from anon, authenticated;

create function public.lock_experiment_result() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'Saved result cards are immutable';
end;
$$;
create trigger lock_experiment_result before update on public.experiment_results
for each row execute function public.lock_experiment_result();

create function public.lock_app_experiment_context() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.app_context is distinct from old.app_context then
    raise exception 'Experiment context is immutable';
  end if;
  return new;
end;
$$;
create trigger lock_app_experiment_context before update on public.experiments
for each row execute function public.lock_app_experiment_context();

alter function public.touch_updated_at() set search_path = '';
