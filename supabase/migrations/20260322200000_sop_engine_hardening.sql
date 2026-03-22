-- SOP engine hardening: atomic run+sop_due, event dedupe, compliance snapshot (ADR-006 / ADR-002).

-- ─── sop_runs: source event for dedupe (event-based triggers) ────────────────

alter table public.sop_runs
  add column if not exists source_event_id uuid references public.events(id) on delete set null;

create unique index if not exists sop_runs_source_event_dedup
  on public.sop_runs (farm_id, trigger_id, source_event_id)
  where source_event_id is not null and trigger_id is not null;

comment on column public.sop_runs.source_event_id is
  'When set, run was created from this domain event; unique per farm+trigger prevents duplicate obligations.';

-- ─── Derived: daily compliance snapshot (per cycle, calendar day) ─────────────

create table if not exists public.sop_compliance_daily (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid not null references public.grow_cycles(id) on delete cascade,
  compliance_date date not null,
  runs_due integer not null default 0,
  runs_completed integer not null default 0,
  runs_missed integer not null default 0,
  runs_open integer not null default 0,
  computed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, cycle_id, compliance_date)
);

comment on column public.sop_compliance_daily.runs_due is
  'Total sop_runs for this cycle and compliance_date (anchor_date = day); buckets sum to this when statuses partition the set.';

create index if not exists sop_compliance_daily_farm_day
  on public.sop_compliance_daily (farm_id, compliance_date desc);

create trigger sop_compliance_daily_updated_at
  before update on public.sop_compliance_daily
  for each row execute function public.set_updated_at();

alter table public.sop_compliance_daily enable row level security;

drop policy if exists sop_compliance_daily_all on public.sop_compliance_daily;
create policy sop_compliance_daily_all on public.sop_compliance_daily for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

-- ─── RPC: single transaction — sop_run + sop_due event + related_event_id ─────

create or replace function public.create_sop_run_with_due_event(
  p_farm_id uuid,
  p_cycle_id uuid,
  p_scope_id uuid,
  p_sop_definition_id uuid,
  p_trigger_id uuid,
  p_assignment_id uuid,
  p_anchor_date date,
  p_due_at timestamptz,
  p_due_window_start timestamptz,
  p_due_window_end timestamptz,
  p_priority text,
  p_reason_text text,
  p_trigger_snapshot jsonb,
  p_source_event_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_event_id uuid;
  v_prio text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_farm_id is null or p_farm_id not in (select public.user_farm_ids()) then
    raise exception 'Invalid farm access';
  end if;

  perform public.assert_fk_farm(p_farm_id, 'grow_cycles', p_cycle_id, 'create_sop_run_with_due_event.cycle_id');
  perform public.assert_fk_farm(p_farm_id, 'sop_definitions', p_sop_definition_id, 'create_sop_run_with_due_event.sop_definition_id');
  if p_trigger_id is not null then
    perform public.assert_fk_farm(p_farm_id, 'sop_triggers', p_trigger_id, 'create_sop_run_with_due_event.trigger_id');
  end if;
  if p_assignment_id is not null then
    perform public.assert_fk_farm(p_farm_id, 'sop_assignments', p_assignment_id, 'create_sop_run_with_due_event.assignment_id');
  end if;
  if p_scope_id is not null then
    perform public.assert_fk_farm(p_farm_id, 'scopes', p_scope_id, 'create_sop_run_with_due_event.scope_id');
  end if;
  if p_source_event_id is not null then
    perform public.assert_fk_farm(p_farm_id, 'events', p_source_event_id, 'create_sop_run_with_due_event.source_event_id');
  end if;

  v_prio := coalesce(nullif(trim(p_priority), ''), 'normal');
  if v_prio not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Invalid sop run priority';
  end if;

  insert into public.sop_runs (
    farm_id,
    sop_definition_id,
    trigger_id,
    assignment_id,
    cycle_id,
    scope_id,
    anchor_date,
    due_at,
    due_window_start,
    due_window_end,
    status,
    priority,
    reason_text,
    trigger_snapshot,
    source_event_id
  )
  values (
    p_farm_id,
    p_sop_definition_id,
    p_trigger_id,
    p_assignment_id,
    p_cycle_id,
    p_scope_id,
    p_anchor_date,
    p_due_at,
    p_due_window_start,
    p_due_window_end,
    'open',
    v_prio,
    p_reason_text,
    coalesce(p_trigger_snapshot, '{}'::jsonb),
    p_source_event_id
  )
  returning id into v_run_id;

  insert into public.events (
    farm_id,
    cycle_id,
    scope_id,
    event_type,
    title,
    body,
    occurred_at,
    source_type,
    payload,
    created_by
  )
  values (
    p_farm_id,
    p_cycle_id,
    p_scope_id,
    'sop_due',
    'SOP due',
    coalesce(p_reason_text, 'Scheduled SOP obligation created'),
    now(),
    'internal_system',
    jsonb_build_object(
      'sop_run_id', v_run_id,
      'sop_definition_id', p_sop_definition_id,
      'trigger_id', p_trigger_id,
      'assignment_id', p_assignment_id,
      'anchor_date', p_anchor_date
    ),
    auth.uid()
  )
  returning id into v_event_id;

  update public.sop_runs
  set related_event_id = v_event_id
  where id = v_run_id;

  return v_run_id;
end;
$$;

grant execute on function public.create_sop_run_with_due_event(
  uuid, uuid, uuid, uuid, uuid, uuid, date, timestamptz, timestamptz, timestamptz,
  text, text, jsonb, uuid
) to authenticated;

-- ─── RPC: refresh compliance aggregates for a cycle day ─────────────────────

create or replace function public.refresh_sop_compliance_daily(
  p_farm_id uuid,
  p_cycle_id uuid,
  p_on date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_due int;
  v_done int;
  v_missed int;
  v_open int;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_farm_id is null or p_farm_id not in (select public.user_farm_ids()) then
    raise exception 'Invalid farm access';
  end if;
  perform public.assert_fk_farm(p_farm_id, 'grow_cycles', p_cycle_id, 'refresh_sop_compliance_daily.cycle_id');

  select
    count(*)::int,
    count(*) filter (where status = 'completed')::int,
    count(*) filter (where status in ('skipped', 'blocked', 'cancelled'))::int,
    count(*) filter (where status in ('open', 'acknowledged', 'overdue'))::int
  into v_due, v_done, v_missed, v_open
  from public.sop_runs
  where farm_id = p_farm_id
    and cycle_id = p_cycle_id
    and anchor_date = p_on;

  insert into public.sop_compliance_daily (
    farm_id, cycle_id, compliance_date,
    runs_due, runs_completed, runs_missed, runs_open, computed_at
  )
  values (
    p_farm_id, p_cycle_id, p_on,
    coalesce(v_due, 0),
    coalesce(v_done, 0),
    coalesce(v_missed, 0),
    coalesce(v_open, 0),
    now()
  )
  on conflict (farm_id, cycle_id, compliance_date) do update set
    runs_due = excluded.runs_due,
    runs_completed = excluded.runs_completed,
    runs_missed = excluded.runs_missed,
    runs_open = excluded.runs_open,
    computed_at = excluded.computed_at;
end;
$$;

grant execute on function public.refresh_sop_compliance_daily(uuid, uuid, date) to authenticated;

-- ─── Farm consistency: source_event_id on sop_runs ───────────────────────────

drop trigger if exists sop_runs_validate_farm_refs on public.sop_runs;
create trigger sop_runs_validate_farm_refs
  before insert or update on public.sop_runs
  for each row execute function public.validate_referenced_farms(
    'sop_definition_id', 'sop_definitions',
    'trigger_id', 'sop_triggers',
    'assignment_id', 'sop_assignments',
    'related_event_id', 'events',
    'source_event_id', 'events',
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes',
    'plant_id', 'plants'
  );
