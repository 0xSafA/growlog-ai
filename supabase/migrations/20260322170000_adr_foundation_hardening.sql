-- ADR hardening pass for ADR-002 / ADR-009 / ADR-008.
-- Adds farm-consistency guards across cross-table references and strengthens
-- background job enqueue + membership policies without editing prior migrations.

-- ─── Generic farm-reference validators ───────────────────────────────────────

create or replace function public.assert_fk_farm(
  p_expected_farm_id uuid,
  p_table_name text,
  p_ref_id uuid,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual_farm_id uuid;
begin
  if p_ref_id is null then
    return;
  end if;

  execute format('select farm_id from public.%I where id = $1', p_table_name)
    into v_actual_farm_id
    using p_ref_id;

  if v_actual_farm_id is null then
    raise exception '% reference not found or inaccessible', p_label;
  end if;

  if v_actual_farm_id <> p_expected_farm_id then
    raise exception '% farm mismatch', p_label;
  end if;
end;
$$;

create or replace function public.assert_fk_farm_or_global(
  p_expected_farm_id uuid,
  p_table_name text,
  p_ref_id uuid,
  p_label text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual_farm_id uuid;
begin
  if p_ref_id is null then
    return;
  end if;

  execute format('select farm_id from public.%I where id = $1', p_table_name)
    into v_actual_farm_id
    using p_ref_id;

  if v_actual_farm_id is null then
    raise exception '% reference not found or inaccessible', p_label;
  end if;

  if v_actual_farm_id is not null and v_actual_farm_id <> p_expected_farm_id then
    raise exception '% farm mismatch', p_label;
  end if;
end;
$$;

create or replace function public.validate_referenced_farms()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_column_name text;
  v_table_name text;
  v_value_text text;
  i integer;
begin
  if NEW.farm_id is null then
    raise exception '% requires farm_id', TG_TABLE_NAME;
  end if;

  if array_length(TG_ARGV, 1) is null then
    return NEW;
  end if;

  i := 0;
  while i < array_length(TG_ARGV, 1) loop
    v_column_name := TG_ARGV[i];
    v_table_name := TG_ARGV[i + 1];
    v_value_text := to_jsonb(NEW) ->> v_column_name;

    if v_value_text is not null then
      perform public.assert_fk_farm(
        NEW.farm_id,
        v_table_name,
        v_value_text::uuid,
        format('%s.%s', TG_TABLE_NAME, v_column_name)
      );
    end if;

    i := i + 2;
  end loop;

  return NEW;
end;
$$;

create or replace function public.validate_sensor_readings_farm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_fk_farm(NEW.farm_id, 'sensor_devices', NEW.device_id, 'sensor_readings.device_id');
  perform public.assert_fk_farm(NEW.farm_id, 'grow_cycles', NEW.cycle_id, 'sensor_readings.cycle_id');
  perform public.assert_fk_farm(NEW.farm_id, 'farm_zones', NEW.zone_id, 'sensor_readings.zone_id');
  perform public.assert_fk_farm(NEW.farm_id, 'scopes', NEW.scope_id, 'sensor_readings.scope_id');
  perform public.assert_fk_farm(NEW.farm_id, 'plants', NEW.plant_id, 'sensor_readings.plant_id');
  perform public.assert_fk_farm_or_global(NEW.farm_id, 'sensor_metrics', NEW.metric_id, 'sensor_readings.metric_id');
  return NEW;
end;
$$;

create or replace function public.validate_event_entities_farm()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.assert_fk_farm(NEW.farm_id, 'events', NEW.event_id, 'event_entities.event_id');

  case NEW.entity_type
    when 'photo' then
      perform public.assert_fk_farm(NEW.farm_id, 'media_assets', NEW.entity_id, 'event_entities.entity_id');
    when 'sensor_reading' then
      perform public.assert_fk_farm(NEW.farm_id, 'sensor_readings', NEW.entity_id, 'event_entities.entity_id');
    when 'sop_execution' then
      perform public.assert_fk_farm(NEW.farm_id, 'sop_executions', NEW.entity_id, 'event_entities.entity_id');
    when 'insight' then
      perform public.assert_fk_farm(NEW.farm_id, 'ai_insights', NEW.entity_id, 'event_entities.entity_id');
    when 'report' then
      perform public.assert_fk_farm(NEW.farm_id, 'reports', NEW.entity_id, 'event_entities.entity_id');
    when 'conversation_message' then
      perform public.assert_fk_farm(NEW.farm_id, 'conversation_messages', NEW.entity_id, 'event_entities.entity_id');
    else
      raise exception 'Unsupported event_entities.entity_type: %', NEW.entity_type;
  end case;

  return NEW;
end;
$$;

-- ─── Trigger attachments for farm-consistency ────────────────────────────────

drop trigger if exists farm_zones_validate_farm_refs on public.farm_zones;
create trigger farm_zones_validate_farm_refs
  before insert or update on public.farm_zones
  for each row execute function public.validate_referenced_farms('site_id', 'farm_sites', 'parent_zone_id', 'farm_zones');

drop trigger if exists grow_cycles_validate_farm_refs on public.grow_cycles;
create trigger grow_cycles_validate_farm_refs
  before insert or update on public.grow_cycles
  for each row execute function public.validate_referenced_farms('site_id', 'farm_sites', 'zone_id', 'farm_zones');

drop trigger if exists plant_groups_validate_farm_refs on public.plant_groups;
create trigger plant_groups_validate_farm_refs
  before insert or update on public.plant_groups
  for each row execute function public.validate_referenced_farms('cycle_id', 'grow_cycles', 'zone_id', 'farm_zones');

drop trigger if exists plants_validate_farm_refs on public.plants;
create trigger plants_validate_farm_refs
  before insert or update on public.plants
  for each row execute function public.validate_referenced_farms('cycle_id', 'grow_cycles', 'zone_id', 'farm_zones');

drop trigger if exists scopes_validate_farm_refs on public.scopes;
create trigger scopes_validate_farm_refs
  before insert or update on public.scopes
  for each row execute function public.validate_referenced_farms(
    'cycle_id', 'grow_cycles',
    'parent_scope_id', 'scopes',
    'site_id', 'farm_sites',
    'zone_id', 'farm_zones',
    'plant_id', 'plants',
    'plant_group_id', 'plant_groups'
  );

drop trigger if exists events_validate_farm_refs on public.events;
create trigger events_validate_farm_refs
  before insert or update on public.events
  for each row execute function public.validate_referenced_farms(
    'site_id', 'farm_sites',
    'zone_id', 'farm_zones',
    'cycle_id', 'grow_cycles',
    'scope_id', 'scopes',
    'plant_id', 'plants',
    'plant_group_id', 'plant_groups'
  );

drop trigger if exists event_entities_validate_farm_refs on public.event_entities;
create trigger event_entities_validate_farm_refs
  before insert or update on public.event_entities
  for each row execute function public.validate_event_entities_farm();

drop trigger if exists event_links_validate_farm_refs on public.event_links;
create trigger event_links_validate_farm_refs
  before insert or update on public.event_links
  for each row execute function public.validate_referenced_farms('from_event_id', 'events', 'to_event_id', 'events');

drop trigger if exists observations_validate_farm_refs on public.observations;
create trigger observations_validate_farm_refs
  before insert or update on public.observations
  for each row execute function public.validate_referenced_farms(
    'event_id', 'events',
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes',
    'plant_id', 'plants'
  );

drop trigger if exists actions_log_validate_farm_refs on public.actions_log;
create trigger actions_log_validate_farm_refs
  before insert or update on public.actions_log
  for each row execute function public.validate_referenced_farms(
    'event_id', 'events',
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes',
    'plant_id', 'plants'
  );

drop trigger if exists sensor_devices_validate_farm_refs on public.sensor_devices;
create trigger sensor_devices_validate_farm_refs
  before insert or update on public.sensor_devices
  for each row execute function public.validate_referenced_farms('site_id', 'farm_sites', 'zone_id', 'farm_zones');

drop trigger if exists sensor_readings_validate_farm_refs on public.sensor_readings;
create trigger sensor_readings_validate_farm_refs
  before insert or update on public.sensor_readings
  for each row execute function public.validate_sensor_readings_farm();

drop trigger if exists media_assets_validate_farm_refs on public.media_assets;
create trigger media_assets_validate_farm_refs
  before insert or update on public.media_assets
  for each row execute function public.validate_referenced_farms(
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes',
    'plant_id', 'plants'
  );

drop trigger if exists sop_documents_validate_farm_refs on public.sop_documents;
create trigger sop_documents_validate_farm_refs
  before insert or update on public.sop_documents
  for each row execute function public.validate_referenced_farms('media_asset_id', 'media_assets');

drop trigger if exists sop_definitions_validate_farm_refs on public.sop_definitions;
create trigger sop_definitions_validate_farm_refs
  before insert or update on public.sop_definitions
  for each row execute function public.validate_referenced_farms('document_id', 'sop_documents');

drop trigger if exists sop_triggers_validate_farm_refs on public.sop_triggers;
create trigger sop_triggers_validate_farm_refs
  before insert or update on public.sop_triggers
  for each row execute function public.validate_referenced_farms('sop_definition_id', 'sop_definitions');

drop trigger if exists sop_assignments_validate_farm_refs on public.sop_assignments;
create trigger sop_assignments_validate_farm_refs
  before insert or update on public.sop_assignments
  for each row execute function public.validate_referenced_farms(
    'sop_definition_id', 'sop_definitions',
    'site_id', 'farm_sites',
    'zone_id', 'farm_zones',
    'cycle_id', 'grow_cycles',
    'scope_id', 'scopes',
    'plant_id', 'plants'
  );

drop trigger if exists sop_runs_validate_farm_refs on public.sop_runs;
create trigger sop_runs_validate_farm_refs
  before insert or update on public.sop_runs
  for each row execute function public.validate_referenced_farms(
    'sop_definition_id', 'sop_definitions',
    'trigger_id', 'sop_triggers',
    'assignment_id', 'sop_assignments',
    'related_event_id', 'events',
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes',
    'plant_id', 'plants'
  );

drop trigger if exists sop_executions_validate_farm_refs on public.sop_executions;
create trigger sop_executions_validate_farm_refs
  before insert or update on public.sop_executions
  for each row execute function public.validate_referenced_farms(
    'sop_run_id', 'sop_runs',
    'event_id', 'events',
    'scope_id', 'scopes'
  );

drop trigger if exists photo_analysis_validate_farm_refs on public.photo_analysis;
create trigger photo_analysis_validate_farm_refs
  before insert or update on public.photo_analysis
  for each row execute function public.validate_referenced_farms(
    'media_asset_id', 'media_assets',
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes',
    'plant_id', 'plants'
  );

drop trigger if exists ai_insights_validate_farm_refs on public.ai_insights;
create trigger ai_insights_validate_farm_refs
  before insert or update on public.ai_insights
  for each row execute function public.validate_referenced_farms(
    'cycle_id', 'grow_cycles',
    'scope_id', 'scopes',
    'zone_id', 'farm_zones',
    'plant_id', 'plants',
    'event_id', 'events'
  );

drop trigger if exists insight_grounding_validate_farm_refs on public.insight_grounding;
create trigger insight_grounding_validate_farm_refs
  before insert or update on public.insight_grounding
  for each row execute function public.validate_referenced_farms('insight_id', 'ai_insights');

drop trigger if exists reports_validate_farm_refs on public.reports;
create trigger reports_validate_farm_refs
  before insert or update on public.reports
  for each row execute function public.validate_referenced_farms(
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes'
  );

drop trigger if exists report_artifacts_validate_farm_refs on public.report_artifacts;
create trigger report_artifacts_validate_farm_refs
  before insert or update on public.report_artifacts
  for each row execute function public.validate_referenced_farms(
    'report_id', 'reports',
    'media_asset_id', 'media_assets'
  );

drop trigger if exists voice_sessions_validate_farm_refs on public.voice_sessions;
create trigger voice_sessions_validate_farm_refs
  before insert or update on public.voice_sessions
  for each row execute function public.validate_referenced_farms(
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes'
  );

drop trigger if exists conversation_messages_validate_farm_refs on public.conversation_messages;
create trigger conversation_messages_validate_farm_refs
  before insert or update on public.conversation_messages
  for each row execute function public.validate_referenced_farms(
    'session_id', 'voice_sessions',
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes',
    'related_event_id', 'events',
    'media_asset_id', 'media_assets'
  );

drop trigger if exists transcription_jobs_validate_farm_refs on public.transcription_jobs;
create trigger transcription_jobs_validate_farm_refs
  before insert or update on public.transcription_jobs
  for each row execute function public.validate_referenced_farms('media_asset_id', 'media_assets');

drop trigger if exists daily_timelines_validate_farm_refs on public.daily_timelines;
create trigger daily_timelines_validate_farm_refs
  before insert or update on public.daily_timelines
  for each row execute function public.validate_referenced_farms(
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes'
  );

drop trigger if exists searchable_documents_validate_farm_refs on public.searchable_documents;
create trigger searchable_documents_validate_farm_refs
  before insert or update on public.searchable_documents
  for each row execute function public.validate_referenced_farms(
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes',
    'plant_id', 'plants'
  );

drop trigger if exists background_jobs_validate_farm_refs on public.background_jobs;
create trigger background_jobs_validate_farm_refs
  before insert or update on public.background_jobs
  for each row execute function public.validate_referenced_farms('cycle_id', 'grow_cycles', 'scope_id', 'scopes');

-- ─── Idempotency / derived-layer ownership guards ────────────────────────────

create unique index if not exists photo_analysis_media_version_unique
  on public.photo_analysis (media_asset_id, analysis_version);

create unique index if not exists searchable_documents_source_unique
  on public.searchable_documents (farm_id, doc_type, source_id);

-- ─── background_jobs: safer enqueue semantics ────────────────────────────────

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
  v_existing_id uuid;
  v_job_type text;
  v_priority text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  if p_farm_id is null or p_farm_id not in (select public.user_farm_ids()) then
    raise exception 'Invalid farm access';
  end if;

  v_job_type := nullif(trim(p_job_type), '');
  if v_job_type is null then
    raise exception 'job_type is required';
  end if;

  v_priority := coalesce(nullif(trim(p_priority), ''), 'normal');
  if v_priority not in ('critical', 'high', 'normal', 'low') then
    raise exception 'Invalid priority';
  end if;

  perform public.assert_fk_farm(p_farm_id, 'grow_cycles', p_cycle_id, 'background_jobs.cycle_id');
  perform public.assert_fk_farm(p_farm_id, 'scopes', p_scope_id, 'background_jobs.scope_id');

  if p_dedup_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_farm_id::text || ':' || p_dedup_key, 0));

    select id
      into v_existing_id
      from public.background_jobs
     where farm_id = p_farm_id
       and dedup_key = p_dedup_key
       and status in ('pending', 'running', 'retrying')
     order by created_at desc
     limit 1;

    if v_existing_id is not null then
      return v_existing_id;
    end if;
  end if;

  insert into public.background_jobs (
    job_type,
    priority,
    farm_id,
    cycle_id,
    scope_id,
    entity_type,
    entity_id,
    scheduled_for,
    dedup_key,
    correlation_id,
    payload_json
  )
  values (
    v_job_type,
    v_priority,
    p_farm_id,
    p_cycle_id,
    p_scope_id,
    p_entity_type,
    p_entity_id,
    coalesce(p_scheduled_for, now()),
    p_dedup_key,
    p_correlation_id,
    coalesce(p_payload_json, '{}'::jsonb)
  )
  returning id into v_id;

  return v_id;
end;
$$;

-- ─── farm_users: tighten UPDATE policy to match trigger contract ─────────────

drop policy if exists farm_users_update on public.farm_users;

create policy farm_users_update on public.farm_users for update
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
  )
  with check (
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
