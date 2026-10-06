-- Apply after phase_two. No production migration is run by installing this code.
create table public.experiment_cycles (
  id uuid primary key,
  user_id uuid not null references public.wearable_accounts(user_id) on delete cascade,
  vetoed_item_id text,
  created_at timestamptz not null,
  unique (id, user_id)
);
create table public.experiments (
  id uuid primary key,
  user_id uuid not null references public.wearable_accounts(user_id) on delete cascade,
  cycle_id uuid not null,
  pre_registration jsonb not null,
  status text not null check (status in ('active', 'completed', 'switched', 'cancelled')),
  started_at timestamptz not null,
  ended_at timestamptz,
  foreign key (cycle_id, user_id) references public.experiment_cycles(id, user_id) on delete cascade,
  check ((status = 'active' and ended_at is null) or (status <> 'active' and ended_at is not null and ended_at >= started_at)),
  check (coalesce(
    pre_registration->>'experimentId' = id::text and pre_registration->>'cycleId' = cycle_id::text and
    (pre_registration->>'version')::integer = 1 and (pre_registration->>'alpha')::numeric = 0.05 and
    pre_registration->>'direction' in ('higher','lower') and
    (pre_registration->>'lockedAt')::timestamptz = started_at and
    jsonb_typeof(pre_registration->'schedule'->'days') = 'array', false))
);
create unique index one_active_experiment_per_user on public.experiments(user_id) where status = 'active';
create table public.experiment_check_ins (
  experiment_id uuid not null references public.experiments(id) on delete cascade,
  sleep_date date not null,
  entry jsonb not null,
  recorded_at timestamptz not null,
  primary key (experiment_id, sleep_date),
  check (coalesce(entry->>'sleepDate' = sleep_date::text and
    entry->>'exposure' in ('on','off','unknown') and entry->>'tap' in ('did','didnt','unknown'), false))
);

create function public.lock_experiment_registration() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.pre_registration is distinct from old.pre_registration or new.id is distinct from old.id or
     new.user_id is distinct from old.user_id or new.cycle_id is distinct from old.cycle_id or
     new.started_at is distinct from old.started_at then
    raise exception 'Pre-registration is immutable after start';
  end if;
  if old.status <> 'active' and new is distinct from old then
    raise exception 'Closed experiment cannot be changed';
  end if;
  return new;
end;
$$;
create trigger lock_experiment_registration before update on public.experiments
  for each row execute function public.lock_experiment_registration();
create function public.lock_experiment_veto() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.created_at is distinct from old.created_at or
     (old.vetoed_item_id is not null and new.vetoed_item_id is distinct from old.vetoed_item_id) then
    raise exception 'Veto already used in this cycle';
  end if;
  return new;
end;
$$;
create trigger lock_experiment_veto before update on public.experiment_cycles
  for each row execute function public.lock_experiment_veto();

alter table public.experiment_cycles enable row level security;
alter table public.experiments enable row level security;
alter table public.experiment_check_ins enable row level security;
revoke all on public.experiment_cycles, public.experiments, public.experiment_check_ins from anon, authenticated;
