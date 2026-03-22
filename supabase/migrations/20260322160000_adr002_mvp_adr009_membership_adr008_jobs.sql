-- ADR-002 Product MVP slice, ADR-009 membership hardening, ADR-008 background_jobs + enqueue RPC
-- Embeddings: use jsonb until pgvector is enabled (ADR-002); add vector column in a follow-up migration if needed.

-- ─── SOP documents (for sop_definitions.document_id) ─────────────────────────

create table public.sop_documents (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  title text not null,
  version text,
  status text not null default 'active' check (status in ('active', 'archived', 'draft')),
  description text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  parsed_text text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sop_definitions
  add column if not exists document_id uuid references public.sop_documents(id) on delete set null;

create trigger sop_documents_updated_at before update on public.sop_documents
  for each row execute function public.set_updated_at();

-- ─── Event links ─────────────────────────────────────────────────────────────

create table public.event_links (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  from_event_id uuid not null references public.events(id) on delete cascade,
  to_event_id uuid not null references public.events(id) on delete cascade,
  relation_type text not null check (relation_type in (
    'caused_by', 'follows_up', 'confirms', 'contradicts', 'related_to', 'references', 'resolved_by'
  )),
  confidence numeric(5,4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_links_no_self check (from_event_id <> to_event_id)
);

create trigger event_links_updated_at before update on public.event_links
  for each row execute function public.set_updated_at();

-- ─── Observations & actions_log ─────────────────────────────────────────────

create table public.observations (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  observation_type text not null check (observation_type in (
    'leaf_color', 'flower_state', 'pest_sign', 'smell', 'vigor', 'disease_risk',
    'substrate_state', 'root_state', 'general_note'
  )),
  label text,
  value_text text,
  value_number numeric,
  value_unit text,
  normalized_value jsonb,
  confidence numeric(5,4),
  is_user_confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger observations_updated_at before update on public.observations
  for each row execute function public.set_updated_at();

create table public.actions_log (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  action_type text not null check (action_type in (
    'watering', 'feeding', 'flushing', 'pruning', 'defoliation', 'training', 'transplant',
    'harvesting', 'cleaning', 'maintenance'
  )),
  started_at timestamptz,
  completed_at timestamptz,
  parameters jsonb not null default '{}'::jsonb,
  result_text text,
  performed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger actions_log_updated_at before update on public.actions_log
  for each row execute function public.set_updated_at();

-- ─── Sensor devices + FK from sensor_readings ────────────────────────────────

create table public.sensor_devices (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  site_id uuid references public.farm_sites(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  name text not null,
  device_type text not null check (device_type in (
    'temp_sensor', 'humidity_sensor', 'co2_meter', 'ph_probe', 'ec_probe', 'camera', 'controller', 'other'
  )),
  vendor text,
  model text,
  serial_number text,
  api_source text,
  status text not null default 'active' check (status in ('active', 'inactive', 'error', 'retired')),
  config jsonb not null default '{}'::jsonb,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sensor_devices_updated_at before update on public.sensor_devices
  for each row execute function public.set_updated_at();

alter table public.sensor_readings
  drop constraint if exists sensor_readings_device_id_fkey;

alter table public.sensor_readings
  add constraint sensor_readings_device_id_fkey
  foreign key (device_id) references public.sensor_devices(id) on delete set null;

-- ─── Photo analysis (derived) ────────────────────────────────────────────────

create table public.photo_analysis (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  analysis_version text not null,
  summary_text text,
  signals jsonb not null default '{}'::jsonb,
  issues_detected jsonb not null default '[]'::jsonb,
  tags text[] not null default '{}',
  confidence numeric(5,4),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger photo_analysis_updated_at before update on public.photo_analysis
  for each row execute function public.set_updated_at();

-- ─── Reports ────────────────────────────────────────────────────────────────

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  report_type text not null check (report_type in ('daily', 'cycle', 'manager', 'public_html', 'pdf', 'other')),
  title text not null,
  status text not null default 'draft' check (status in ('draft', 'ready', 'published', 'failed', 'archived')),
  period_start timestamptz,
  period_end timestamptz,
  summary_text text,
  narrative_text text,
  report_json jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger reports_updated_at before update on public.reports
  for each row execute function public.set_updated_at();

create table public.report_artifacts (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  artifact_type text not null check (artifact_type in ('pdf', 'html', 'json_export', 'preview_image', 'other')),
  media_asset_id uuid references public.media_assets(id) on delete set null,
  url text,
  version text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger report_artifacts_updated_at before update on public.report_artifacts
  for each row execute function public.set_updated_at();

-- ─── Voice & conversation ───────────────────────────────────────────────────

create table public.voice_sessions (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled', 'error')),
  context_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger voice_sessions_updated_at before update on public.voice_sessions
  for each row execute function public.set_updated_at();

create table public.conversation_messages (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  session_id uuid references public.voice_sessions(id) on delete set null,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  related_event_id uuid references public.events(id) on delete set null,
  role text not null check (role in ('user', 'assistant', 'system')),
  modality text not null check (modality in ('text', 'voice')),
  message_text text,
  media_asset_id uuid references public.media_assets(id) on delete set null,
  transcript_confidence numeric(5,4),
  grounding_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.transcription_jobs (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  status text not null check (status in ('pending', 'processing', 'completed', 'failed')),
  transcript_text text,
  segments_json jsonb not null default '[]'::jsonb,
  language text,
  model_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger transcription_jobs_updated_at before update on public.transcription_jobs
  for each row execute function public.set_updated_at();

-- ─── Derived: daily timelines ─────────────────────────────────────────────────

create table public.daily_timelines (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  timeline_date date not null,
  summary_text text,
  summary_json jsonb not null default '{}'::jsonb,
  event_count integer not null default 0,
  photo_count integer not null default 0,
  issue_count integer not null default 0,
  anomaly_count integer not null default 0,
  sop_due_count integer not null default 0,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger daily_timelines_updated_at before update on public.daily_timelines
  for each row execute function public.set_updated_at();

-- ─── Searchable documents (retrieval); embedding optional via pgvector ───────

create table public.searchable_documents (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  doc_type text not null check (doc_type in (
    'event', 'observation', 'photo_analysis', 'sop_definition', 'ai_insight',
    'grow_memory_item', 'report', 'knowledge_item', 'other'
  )),
  source_id uuid not null,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  title text,
  body text not null,
  metadata jsonb not null default '{}'::jsonb,
  embedding jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger searchable_documents_updated_at before update on public.searchable_documents
  for each row execute function public.set_updated_at();

-- ─── ai_insights: ADR-002 alignment ──────────────────────────────────────────

alter table public.ai_insights
  add column if not exists zone_id uuid references public.farm_zones(id) on delete set null;

alter table public.ai_insights
  add column if not exists plant_id uuid references public.plants(id) on delete set null;

alter table public.ai_insights
  add column if not exists event_id uuid references public.events(id) on delete set null;

alter table public.ai_insights
  add column if not exists valid_from timestamptz;

alter table public.ai_insights
  add column if not exists valid_to timestamptz;

alter table public.ai_insights
  add column if not exists priority text;

alter table public.ai_insights
  add column if not exists model_version text;

-- ─── ADR-008: background jobs ────────────────────────────────────────────────

create table public.background_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status text not null default 'pending' check (status in (
    'pending', 'running', 'succeeded', 'failed', 'retrying', 'cancelled', 'stale'
  )),
  priority text not null default 'normal' check (priority in ('critical', 'high', 'normal', 'low')),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  entity_type text,
  entity_id uuid,
  scheduled_for timestamptz not null default now(),
  dedup_key text,
  correlation_id text,
  payload_json jsonb not null default '{}'::jsonb,
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index background_jobs_drain_idx on public.background_jobs (status, scheduled_for, farm_id);
create index background_jobs_farm_created on public.background_jobs (farm_id, created_at desc);
create index background_jobs_dedup on public.background_jobs (farm_id, dedup_key) where dedup_key is not null;

-- ─── ADR-002 recommended indexes (existing tables) ───────────────────────────

create index if not exists events_farm_occurred on public.events (farm_id, occurred_at desc);
create index if not exists events_cycle_occurred on public.events (cycle_id, occurred_at desc) where cycle_id is not null;
create index if not exists events_scope_occurred on public.events (scope_id, occurred_at desc) where scope_id is not null;
create index if not exists events_type_occurred on public.events (event_type, occurred_at desc);
create index if not exists events_tags_gin on public.events using gin (tags);

create index if not exists sensor_readings_farm_captured on public.sensor_readings (farm_id, captured_at desc);
create index if not exists sensor_readings_scope_captured on public.sensor_readings (scope_id, captured_at desc) where scope_id is not null;
create index if not exists sensor_readings_zone_captured on public.sensor_readings (zone_id, captured_at desc) where zone_id is not null;
create index if not exists sensor_readings_cycle_captured on public.sensor_readings (cycle_id, captured_at desc) where cycle_id is not null;
create index if not exists sensor_readings_device_captured on public.sensor_readings (device_id, captured_at desc) where device_id is not null;

create index if not exists media_assets_cycle_captured on public.media_assets (cycle_id, captured_at desc) where cycle_id is not null;
create index if not exists media_assets_scope_captured on public.media_assets (scope_id, captured_at desc) where scope_id is not null;
create index if not exists media_assets_zone_captured on public.media_assets (zone_id, captured_at desc) where zone_id is not null;
create index if not exists media_assets_plant_captured on public.media_assets (plant_id, captured_at desc) where plant_id is not null;

create index if not exists sop_runs_farm_due on public.sop_runs (farm_id, (coalesce(due_at, due_window_start)));
create index if not exists sop_runs_status_due on public.sop_runs (status, (coalesce(due_at, due_window_start)));
create index if not exists sop_runs_scope_due on public.sop_runs (scope_id, (coalesce(due_at, due_window_start))) where scope_id is not null;
create index if not exists sop_runs_cycle_due on public.sop_runs (cycle_id, (coalesce(due_at, due_window_start))) where cycle_id is not null;

create index if not exists ai_insights_scope_created on public.ai_insights (scope_id, created_at desc) where scope_id is not null;
create index if not exists ai_insights_insight_type_created on public.ai_insights (insight_type, created_at desc);

-- New tables helper indexes
create index observations_event on public.observations (event_id);
create index actions_log_event on public.actions_log (event_id);
create index event_links_farm on public.event_links (farm_id);
create index photo_analysis_media on public.photo_analysis (media_asset_id);
create index reports_farm_created on public.reports (farm_id, created_at desc);
create index conversation_messages_session on public.conversation_messages (session_id);
create index searchable_documents_farm_type on public.searchable_documents (farm_id, doc_type);
create index searchable_documents_scope on public.searchable_documents (scope_id) where scope_id is not null;

-- ─── farm_users: enforce safe updates/deletes (ADR-009) ──────────────────────

create or replace function public.farm_users_enforce_mutations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_admin boolean;
begin
  if TG_OP = 'UPDATE' then
    if NEW.user_id <> OLD.user_id or NEW.farm_id <> OLD.farm_id then
      raise exception 'Cannot change user_id or farm_id';
    end if;

    if NEW.role is distinct from OLD.role then
      select exists(
        select 1 from public.farm_users fu
        where fu.farm_id = OLD.farm_id and fu.user_id = auth.uid() and fu.role = 'admin'
      ) into actor_is_admin;
      if not coalesce(actor_is_admin, false) then
        raise exception 'Only farm admins can change roles';
      end if;
    end if;

    if OLD.user_id <> auth.uid() then
      select exists(
        select 1 from public.farm_users fu
        where fu.farm_id = OLD.farm_id and fu.user_id = auth.uid() and fu.role = 'admin'
      ) into actor_is_admin;
      if not coalesce(actor_is_admin, false) then
        raise exception 'Only farm admins can edit other members';
      end if;
    end if;

    return NEW;
  end if;

  if TG_OP = 'DELETE' then
    if OLD.user_id = auth.uid() then
      return OLD;
    end if;
    select exists(
      select 1 from public.farm_users fu
      where fu.farm_id = OLD.farm_id and fu.user_id = auth.uid() and fu.role = 'admin'
    ) into actor_is_admin;
    if not coalesce(actor_is_admin, false) then
      raise exception 'Only farm admins can remove other members';
    end if;
    return OLD;
  end if;

  return null;
end;
$$;

drop trigger if exists farm_users_enforce_mutations_trigger on public.farm_users;
create trigger farm_users_enforce_mutations_trigger
  before update or delete on public.farm_users
  for each row execute function public.farm_users_enforce_mutations();

drop policy if exists farm_users_update on public.farm_users;
drop policy if exists farm_users_delete on public.farm_users;

create policy farm_users_update on public.farm_users for update
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy farm_users_delete on public.farm_users for delete
  using (
    farm_id in (select public.user_farm_ids())
    and (
      user_id = auth.uid()
      or exists (
        select 1 from public.farm_users fu
        where fu.farm_id = farm_users.farm_id
          and fu.user_id = auth.uid()
          and fu.role = 'admin'
      )
    )
  );

-- ─── RPC: membership (trusted) ──────────────────────────────────────────────

create or replace function public.set_farm_user_role(
  p_farm_id uuid,
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_role not in ('grower', 'manager', 'admin', 'viewer') then
    raise exception 'Invalid role';
  end if;
  if not exists (
    select 1 from public.farm_users
    where farm_id = p_farm_id and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Not authorized';
  end if;
  update public.farm_users
  set role = p_role
  where farm_id = p_farm_id and user_id = p_user_id;
  if not found then
    raise exception 'Membership not found';
  end if;
end;
$$;

create or replace function public.add_farm_user_membership(
  p_farm_id uuid,
  p_user_id uuid,
  p_role text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_role not in ('grower', 'manager', 'admin', 'viewer') then
    raise exception 'Invalid role';
  end if;
  if not exists (
    select 1 from public.farm_users
    where farm_id = p_farm_id and user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Not authorized';
  end if;
  insert into public.farm_users (farm_id, user_id, role)
  values (p_farm_id, p_user_id, p_role)
  on conflict (farm_id, user_id) do update set role = excluded.role
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.set_farm_user_role(uuid, uuid, text) to authenticated;
grant execute on function public.add_farm_user_membership(uuid, uuid, text) to authenticated;

-- ─── RPC: enqueue background job (ADR-008) ───────────────────────────────────

create or replace function public.enqueue_background_job(
  p_job_type text,
  p_farm_id uuid,
  p_priority text default 'normal',
  p_cycle_id uuid default null,
  p_scope_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_scheduled_for timestamptz default now(),
  p_dedup_key text default null,
  p_correlation_id text default null,
  p_payload_json jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  prio text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_farm_id is null or p_farm_id not in (select public.user_farm_ids()) then
    raise exception 'Invalid farm access';
  end if;
  prio := coalesce(nullif(trim(p_priority), ''), 'normal');
  if prio not in ('critical', 'high', 'normal', 'low') then
    raise exception 'Invalid priority';
  end if;

  insert into public.background_jobs (
    job_type, priority, farm_id, cycle_id, scope_id,
    entity_type, entity_id, scheduled_for, dedup_key, correlation_id, payload_json
  )
  values (
    p_job_type, prio, p_farm_id, p_cycle_id, p_scope_id,
    p_entity_type, p_entity_id, coalesce(p_scheduled_for, now()), p_dedup_key, p_correlation_id, coalesce(p_payload_json, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.enqueue_background_job(
  text, uuid, text, uuid, uuid, text, uuid, timestamptz, text, text, jsonb
) to authenticated;

-- ─── RLS: new tables ─────────────────────────────────────────────────────────

alter table public.sop_documents enable row level security;
create policy sop_documents_all on public.sop_documents for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.event_links enable row level security;
create policy event_links_all on public.event_links for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.observations enable row level security;
create policy observations_all on public.observations for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.actions_log enable row level security;
create policy actions_log_all on public.actions_log for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.sensor_devices enable row level security;
create policy sensor_devices_all on public.sensor_devices for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.photo_analysis enable row level security;
create policy photo_analysis_all on public.photo_analysis for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.reports enable row level security;
create policy reports_all on public.reports for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.report_artifacts enable row level security;
create policy report_artifacts_all on public.report_artifacts for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.voice_sessions enable row level security;
create policy voice_sessions_all on public.voice_sessions for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.conversation_messages enable row level security;
create policy conversation_messages_all on public.conversation_messages for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.transcription_jobs enable row level security;
create policy transcription_jobs_all on public.transcription_jobs for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.daily_timelines enable row level security;
create policy daily_timelines_all on public.daily_timelines for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.searchable_documents enable row level security;
create policy searchable_documents_all on public.searchable_documents for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

alter table public.background_jobs enable row level security;

create policy background_jobs_select on public.background_jobs for select
  using (farm_id in (select public.user_farm_ids()));

create policy background_jobs_no_direct_write on public.background_jobs for insert
  with check (false);

create policy background_jobs_no_direct_update on public.background_jobs for update
  using (false);

create policy background_jobs_no_direct_delete on public.background_jobs for delete
  using (false);

-- Service role bypasses RLS for worker drain.
