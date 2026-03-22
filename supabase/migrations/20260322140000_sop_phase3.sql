-- Growlog AI — Phase 3: SOP (ADR-002 / ADR-006 subset)

-- ─── SOP DEFINITIONS ─────────────────────────────────────────────────────────

create table public.sop_definitions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  code text,
  title text not null,
  description text,
  category text,
  criticality text not null default 'normal' check (criticality in ('low', 'normal', 'high', 'critical')),
  applies_to_scope text not null check (applies_to_scope in (
    'farm', 'site', 'room', 'tent', 'zone', 'bed', 'reservoir', 'plant_group', 'plant'
  )),
  required_inputs_after_execution jsonb not null default '[]'::jsonb,
  severity_if_missed text not null default 'normal' check (severity_if_missed in ('low', 'normal', 'high', 'critical')),
  active boolean not null default true,
  instructions_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sop_triggers (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sop_definition_id uuid not null references public.sop_definitions(id) on delete cascade,
  trigger_type text not null check (trigger_type in (
    'date_based', 'time_based', 'stage_based', 'offset_based', 'event_based',
    'recurring_daily', 'recurring_interval', 'condition_based', 'location_based', 'manual'
  )),
  trigger_config jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.sop_assignments (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sop_definition_id uuid not null references public.sop_definitions(id) on delete cascade,
  site_id uuid references public.farm_sites(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  cycle_id uuid references public.grow_cycles(id) on delete cascade,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  assignment_status text not null default 'active' check (assignment_status in ('active', 'paused', 'ended')),
  effective_from timestamptz,
  effective_to timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sop_definition_id, cycle_id, scope_id)
);

create table public.sop_runs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sop_definition_id uuid not null references public.sop_definitions(id) on delete cascade,
  trigger_id uuid references public.sop_triggers(id) on delete set null,
  assignment_id uuid references public.sop_assignments(id) on delete set null,
  related_event_id uuid references public.events(id) on delete set null,
  cycle_id uuid references public.grow_cycles(id) on delete cascade,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  anchor_date date,
  due_at timestamptz,
  due_window_start timestamptz,
  due_window_end timestamptz,
  status text not null default 'open' check (status in (
    'open', 'acknowledged', 'completed', 'skipped', 'overdue', 'blocked', 'cancelled'
  )),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  reason_text text,
  trigger_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sop_runs_daily_unique on public.sop_runs (sop_definition_id, assignment_id, anchor_date)
  where anchor_date is not null and assignment_id is not null;

create table public.sop_executions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  sop_run_id uuid not null references public.sop_runs(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  executed_by uuid references auth.users(id) on delete set null,
  execution_status text not null check (execution_status in (
    'done', 'skipped', 'delayed', 'blocked', 'partially_done'
  )),
  intent_status text check (intent_status in ('acknowledged', 'will_do', 'needs_help')),
  response_at timestamptz not null default now(),
  completed_at timestamptz,
  notes text,
  performer_feedback text,
  measured_values jsonb not null default '{}'::jsonb,
  evidence_json jsonb not null default '{}'::jsonb,
  result_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- updated_at
create trigger sop_definitions_updated_at before update on public.sop_definitions
  for each row execute function public.set_updated_at();
create trigger sop_triggers_updated_at before update on public.sop_triggers
  for each row execute function public.set_updated_at();
create trigger sop_assignments_updated_at before update on public.sop_assignments
  for each row execute function public.set_updated_at();
create trigger sop_runs_updated_at before update on public.sop_runs
  for each row execute function public.set_updated_at();
create trigger sop_executions_updated_at before update on public.sop_executions
  for each row execute function public.set_updated_at();

-- RLS
alter table public.sop_definitions enable row level security;
alter table public.sop_triggers enable row level security;
alter table public.sop_assignments enable row level security;
alter table public.sop_runs enable row level security;
alter table public.sop_executions enable row level security;

create policy sop_definitions_all on public.sop_definitions for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy sop_triggers_all on public.sop_triggers for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy sop_assignments_all on public.sop_assignments for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy sop_runs_all on public.sop_runs for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy sop_executions_all on public.sop_executions for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));
