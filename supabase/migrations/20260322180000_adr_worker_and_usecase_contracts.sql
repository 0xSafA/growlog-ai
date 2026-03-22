-- ADR-008 worker substrate + transactional write use cases.
-- This migration keeps earlier schema intact and adds production-shape contracts.

-- ─── background_jobs substrate hardening ─────────────────────────────────────

alter table public.background_jobs
  add column if not exists worker_id text;

alter table public.background_jobs
  add column if not exists heartbeat_at timestamptz;

alter table public.background_jobs
  add column if not exists result_json jsonb not null default '{}'::jsonb;

alter table public.background_jobs
  drop constraint if exists background_jobs_payload_json_object_check;

alter table public.background_jobs
  add constraint background_jobs_payload_json_object_check
  check (jsonb_typeof(payload_json) = 'object');

alter table public.background_jobs
  drop constraint if exists background_jobs_result_json_object_check;

alter table public.background_jobs
  add constraint background_jobs_result_json_object_check
  check (jsonb_typeof(result_json) = 'object');

drop index if exists background_jobs_dedup;

create unique index if not exists background_jobs_active_dedup_unique
  on public.background_jobs (farm_id, dedup_key)
  where dedup_key is not null
    and status in ('pending', 'running', 'retrying');

create index if not exists background_jobs_claim_ready_idx
  on public.background_jobs (status, scheduled_for, priority, created_at)
  where status in ('pending', 'retrying');

create or replace function public.background_job_priority_rank(p_priority text)
returns integer
language sql
immutable
as $$
  select case p_priority
    when 'critical' then 1
    when 'high' then 2
    when 'normal' then 3
    when 'low' then 4
    else 100
  end
$$;

create or replace function public.require_service_role()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'service_role_required';
  end if;
end;
$$;

create or replace function public.claim_background_job(
  p_worker_id text,
  p_job_type text default null,
  p_farm_id uuid default null
)
returns setof public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_service_role();
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker_id is required';
  end if;

  return query
  with candidate as (
    select id
    from public.background_jobs
    where status in ('pending', 'retrying')
      and scheduled_for <= now()
      and (p_job_type is null or job_type = p_job_type)
      and (p_farm_id is null or farm_id = p_farm_id)
    order by
      public.background_job_priority_rank(priority),
      scheduled_for asc,
      created_at asc
    for update skip locked
    limit 1
  )
  update public.background_jobs j
     set status = 'running',
         worker_id = nullif(trim(p_worker_id), ''),
         started_at = now(),
         heartbeat_at = now(),
         finished_at = null,
         last_error = null,
         attempt_count = j.attempt_count + 1
    from candidate
   where j.id = candidate.id
  returning j.*;
end;
$$;

create or replace function public.heartbeat_background_job(
  p_job_id uuid,
  p_worker_id text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.require_service_role();
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker_id is required';
  end if;

  update public.background_jobs
     set heartbeat_at = now()
   where id = p_job_id
     and status = 'running'
     and worker_id = nullif(trim(p_worker_id), '');

  if not found then
    raise exception 'Running job not found for worker';
  end if;
end;
$$;

create or replace function public.complete_background_job(
  p_job_id uuid,
  p_worker_id text,
  p_result_json jsonb default '{}'::jsonb
)
returns public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.background_jobs;
begin
  perform public.require_service_role();
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker_id is required';
  end if;

  update public.background_jobs
     set status = 'succeeded',
         worker_id = nullif(trim(p_worker_id), ''),
         heartbeat_at = now(),
         finished_at = now(),
         last_error = null,
         result_json = coalesce(p_result_json, '{}'::jsonb)
   where id = p_job_id
     and status = 'running'
     and worker_id = nullif(trim(p_worker_id), '')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Running job not found for worker';
  end if;

  return v_row;
end;
$$;

create or replace function public.fail_background_job(
  p_job_id uuid,
  p_worker_id text,
  p_last_error text,
  p_retry_delay_seconds integer default null
)
returns public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.background_jobs;
  v_retry boolean;
begin
  perform public.require_service_role();
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker_id is required';
  end if;

  v_retry := p_retry_delay_seconds is not null and p_retry_delay_seconds > 0;

  update public.background_jobs
     set status = case when v_retry then 'retrying' else 'failed' end,
         heartbeat_at = case when v_retry then null else now() end,
         finished_at = case when v_retry then null else now() end,
         scheduled_for = case when v_retry then now() + make_interval(secs => p_retry_delay_seconds) else scheduled_for end,
         last_error = coalesce(nullif(trim(p_last_error), ''), 'job_failed'),
         worker_id = case when v_retry then null else nullif(trim(p_worker_id), '') end
   where id = p_job_id
     and status = 'running'
     and worker_id = nullif(trim(p_worker_id), '')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Running job not found for worker';
  end if;

  return v_row;
end;
$$;

create or replace function public.mark_background_job_stale(
  p_job_id uuid,
  p_worker_id text,
  p_reason text default 'stale'
)
returns public.background_jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.background_jobs;
begin
  perform public.require_service_role();
  if nullif(trim(p_worker_id), '') is null then
    raise exception 'worker_id is required';
  end if;

  update public.background_jobs
     set status = 'stale',
         heartbeat_at = now(),
         finished_at = now(),
         last_error = coalesce(nullif(trim(p_reason), ''), 'stale'),
         worker_id = nullif(trim(p_worker_id), '')
   where id = p_job_id
     and status = 'running'
     and worker_id = nullif(trim(p_worker_id), '')
  returning * into v_row;

  if v_row.id is null then
    raise exception 'Running job not found for worker';
  end if;

  return v_row;
end;
$$;

revoke all on function public.claim_background_job(text, text, uuid) from public;
revoke all on function public.heartbeat_background_job(uuid, text) from public;
revoke all on function public.complete_background_job(uuid, text, jsonb) from public;
revoke all on function public.fail_background_job(uuid, text, text, integer) from public;
revoke all on function public.mark_background_job_stale(uuid, text, text) from public;

grant execute on function public.claim_background_job(text, text, uuid) to service_role;
grant execute on function public.heartbeat_background_job(uuid, text) to service_role;
grant execute on function public.complete_background_job(uuid, text, jsonb) to service_role;
grant execute on function public.fail_background_job(uuid, text, text, integer) to service_role;
grant execute on function public.mark_background_job_stale(uuid, text, text) to service_role;

-- ─── Shared helpers for transactional use cases ──────────────────────────────

create or replace function public.farm_local_date(
  p_farm_id uuid,
  p_ts timestamptz
)
returns date
language sql
stable
security definer
set search_path = public
as $$
  select date(timezone(coalesce(f.timezone, 'UTC'), p_ts))
  from public.farms f
  where f.id = p_farm_id
$$;

create or replace function public.enqueue_standard_event_jobs(
  p_farm_id uuid,
  p_cycle_id uuid,
  p_scope_id uuid,
  p_event_id uuid,
  p_occurred_at timestamptz,
  p_priority text default 'normal'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_timeline_job_id uuid;
  v_doc_job_id uuid;
  v_focus_job_id uuid;
  v_local_date date;
begin
  v_local_date := public.farm_local_date(p_farm_id, p_occurred_at);

  v_doc_job_id := public.enqueue_background_job(
    'document.index',
    p_farm_id,
    p_priority,
    p_cycle_id,
    p_scope_id,
    'event',
    p_event_id,
    now(),
    format('document.index:event:%s', p_event_id),
    p_event_id::text,
    jsonb_build_object('doc_type', 'event', 'source_id', p_event_id)
  );

  v_timeline_job_id := public.enqueue_background_job(
    'timeline.daily.refresh',
    p_farm_id,
    p_priority,
    p_cycle_id,
    p_scope_id,
    'event',
    p_event_id,
    now(),
    format('timeline.daily.refresh:%s:%s', p_scope_id, v_local_date),
    p_event_id::text,
    jsonb_build_object('timeline_date', v_local_date, 'event_id', p_event_id)
  );

  v_focus_job_id := public.enqueue_background_job(
    'focus.refresh',
    p_farm_id,
    p_priority,
    p_cycle_id,
    p_scope_id,
    'event',
    p_event_id,
    now(),
    format('focus.refresh:%s:%s', p_scope_id, v_local_date),
    p_event_id::text,
    jsonb_build_object('focus_date', v_local_date, 'event_id', p_event_id)
  );

  return jsonb_build_object(
    'document_index_job_id', v_doc_job_id,
    'timeline_refresh_job_id', v_timeline_job_id,
    'focus_refresh_job_id', v_focus_job_id
  );
end;
$$;

-- ─── Transactional use cases (ADR-002 / ADR-008) ────────────────────────────

create or replace function public.create_cycle_with_default_scope(
  p_farm_id uuid,
  p_name text,
  p_cultivar_name text default null,
  p_start_date date default current_date,
  p_stage text default 'veg'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cycle public.grow_cycles;
  v_scope public.scopes;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_farm_id is null or p_farm_id not in (select public.user_farm_ids()) then
    raise exception 'Invalid farm access';
  end if;

  insert into public.grow_cycles (
    farm_id, name, cultivar_name, start_date, status, stage, created_by
  )
  values (
    p_farm_id,
    coalesce(nullif(trim(p_name), ''), 'Cycle'),
    nullif(trim(p_cultivar_name), ''),
    coalesce(p_start_date, current_date),
    'active',
    coalesce(nullif(trim(p_stage), ''), 'veg'),
    auth.uid()
  )
  returning * into v_cycle;

  insert into public.scopes (
    farm_id, cycle_id, scope_type, display_name
  )
  values (
    p_farm_id,
    v_cycle.id,
    'tent',
    'Main'
  )
  returning * into v_scope;

  return jsonb_build_object(
    'cycle', to_jsonb(v_cycle),
    'scope', to_jsonb(v_scope)
  );
end;
$$;

create or replace function public.create_foundation_setup(
  p_farm_name text,
  p_timezone text default 'UTC',
  p_cycle_name text default 'Cycle 1',
  p_cultivar_name text default null,
  p_start_date date default current_date,
  p_stage text default 'veg'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm_id uuid;
  v_setup jsonb;
begin
  v_farm_id := public.create_farm_with_membership(p_farm_name, p_timezone);
  v_setup := public.create_cycle_with_default_scope(
    v_farm_id,
    p_cycle_name,
    p_cultivar_name,
    p_start_date,
    p_stage
  );

  return jsonb_build_object(
    'farm_id', v_farm_id,
    'cycle', v_setup->'cycle',
    'scope', v_setup->'scope'
  );
end;
$$;

create or replace function public.create_log_entry(
  p_farm_id uuid,
  p_cycle_id uuid,
  p_scope_id uuid,
  p_event_type text,
  p_body text,
  p_occurred_at timestamptz,
  p_source_type text,
  p_payload jsonb default '{}'::jsonb,
  p_title text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_jobs jsonb;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_farm_id is null or p_farm_id not in (select public.user_farm_ids()) then
    raise exception 'Invalid farm access';
  end if;

  perform public.assert_fk_farm(p_farm_id, 'grow_cycles', p_cycle_id, 'create_log_entry.cycle_id');
  perform public.assert_fk_farm(p_farm_id, 'scopes', p_scope_id, 'create_log_entry.scope_id');

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
    p_event_type,
    nullif(trim(p_title), ''),
    nullif(trim(p_body), ''),
    p_occurred_at,
    p_source_type,
    coalesce(p_payload, '{}'::jsonb),
    auth.uid()
  )
  returning * into v_event;

  v_jobs := public.enqueue_standard_event_jobs(
    p_farm_id,
    p_cycle_id,
    p_scope_id,
    v_event.id,
    p_occurred_at
  );

  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'jobs', v_jobs
  );
end;
$$;

create or replace function public.create_manual_sensor_reading(
  p_farm_id uuid,
  p_cycle_id uuid,
  p_scope_id uuid,
  p_metric_id uuid,
  p_value numeric,
  p_captured_at timestamptz,
  p_unit text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.events;
  v_reading public.sensor_readings;
  v_jobs jsonb;
  v_snapshot_job_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_farm_id is null or p_farm_id not in (select public.user_farm_ids()) then
    raise exception 'Invalid farm access';
  end if;

  perform public.assert_fk_farm(p_farm_id, 'grow_cycles', p_cycle_id, 'create_manual_sensor_reading.cycle_id');
  perform public.assert_fk_farm(p_farm_id, 'scopes', p_scope_id, 'create_manual_sensor_reading.scope_id');
  perform public.assert_fk_farm_or_global(p_farm_id, 'sensor_metrics', p_metric_id, 'create_manual_sensor_reading.metric_id');

  insert into public.events (
    farm_id,
    cycle_id,
    scope_id,
    event_type,
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
    'sensor_snapshot',
    format('Manual reading: %s%s', p_value, coalesce(' ' || nullif(trim(p_unit), ''), '')),
    p_captured_at,
    'user_form',
    jsonb_build_object('metric_id', p_metric_id),
    auth.uid()
  )
  returning * into v_event;

  insert into public.sensor_readings (
    farm_id,
    metric_id,
    cycle_id,
    scope_id,
    captured_at,
    value_numeric,
    unit,
    ingestion_source,
    raw_payload
  )
  values (
    p_farm_id,
    p_metric_id,
    p_cycle_id,
    p_scope_id,
    p_captured_at,
    p_value,
    nullif(trim(p_unit), ''),
    'user_form',
    '{}'::jsonb
  )
  returning * into v_reading;

  update public.events
     set payload = jsonb_build_object(
       'sensor_reading_id', v_reading.id,
       'metric_id', p_metric_id
     )
   where id = v_event.id;

  insert into public.event_entities (
    farm_id,
    event_id,
    entity_type,
    entity_id,
    role
  )
  values (
    p_farm_id,
    v_event.id,
    'sensor_reading',
    v_reading.id,
    'primary'
  );

  v_jobs := public.enqueue_standard_event_jobs(
    p_farm_id,
    p_cycle_id,
    p_scope_id,
    v_event.id,
    p_captured_at
  );

  v_snapshot_job_id := public.enqueue_background_job(
    'snapshot.refresh',
    p_farm_id,
    'high',
    p_cycle_id,
    p_scope_id,
    'sensor_reading',
    v_reading.id,
    now(),
    format('snapshot.refresh:%s:%s', p_scope_id, date_trunc('hour', p_captured_at)),
    v_event.id::text,
    jsonb_build_object(
      'sensor_reading_id', v_reading.id,
      'captured_at', p_captured_at
    )
  );

  return jsonb_build_object(
    'event', (select to_jsonb(e) from public.events e where e.id = v_event.id),
    'reading', to_jsonb(v_reading),
    'jobs', v_jobs || jsonb_build_object('snapshot_refresh_job_id', v_snapshot_job_id)
  );
end;
$$;

create or replace function public.finalize_photo_capture(
  p_farm_id uuid,
  p_cycle_id uuid,
  p_scope_id uuid,
  p_storage_bucket text,
  p_storage_path text,
  p_mime_type text,
  p_file_name text default null,
  p_file_size bigint default null,
  p_caption text default null,
  p_captured_at timestamptz default now()
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_asset public.media_assets;
  v_event public.events;
  v_jobs jsonb;
  v_photo_job_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_farm_id is null or p_farm_id not in (select public.user_farm_ids()) then
    raise exception 'Invalid farm access';
  end if;
  if coalesce(nullif(trim(p_storage_bucket), ''), '') <> 'media' then
    raise exception 'Invalid storage bucket';
  end if;
  if split_part(coalesce(p_storage_path, ''), '/', 1) <> p_farm_id::text then
    raise exception 'Storage path must start with farm_id';
  end if;

  perform public.assert_fk_farm(p_farm_id, 'grow_cycles', p_cycle_id, 'finalize_photo_capture.cycle_id');
  perform public.assert_fk_farm(p_farm_id, 'scopes', p_scope_id, 'finalize_photo_capture.scope_id');

  insert into public.media_assets (
    farm_id,
    cycle_id,
    scope_id,
    uploaded_by,
    storage_bucket,
    storage_path,
    media_type,
    mime_type,
    file_name,
    file_size,
    captured_at
  )
  values (
    p_farm_id,
    p_cycle_id,
    p_scope_id,
    auth.uid(),
    'media',
    p_storage_path,
    'image',
    p_mime_type,
    nullif(trim(p_file_name), ''),
    p_file_size,
    coalesce(p_captured_at, now())
  )
  returning * into v_asset;

  insert into public.events (
    farm_id,
    cycle_id,
    scope_id,
    event_type,
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
    'photo_capture',
    nullif(trim(p_caption), ''),
    coalesce(p_captured_at, now()),
    'file_upload',
    jsonb_build_object('media_asset_id', v_asset.id),
    auth.uid()
  )
  returning * into v_event;

  insert into public.event_entities (
    farm_id,
    event_id,
    entity_type,
    entity_id,
    role
  )
  values (
    p_farm_id,
    v_event.id,
    'photo',
    v_asset.id,
    'primary'
  );

  v_jobs := public.enqueue_standard_event_jobs(
    p_farm_id,
    p_cycle_id,
    p_scope_id,
    v_event.id,
    coalesce(p_captured_at, now()),
    'high'
  );

  v_photo_job_id := public.enqueue_background_job(
    'photo.analyze',
    p_farm_id,
    'high',
    p_cycle_id,
    p_scope_id,
    'media_asset',
    v_asset.id,
    now(),
    format('photo.analyze:%s', v_asset.id),
    v_event.id::text,
    jsonb_build_object('media_asset_id', v_asset.id, 'analysis_version', 'v1')
  );

  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'asset', to_jsonb(v_asset),
    'jobs', v_jobs || jsonb_build_object('photo_analyze_job_id', v_photo_job_id)
  );
end;
$$;

grant execute on function public.create_cycle_with_default_scope(uuid, text, text, date, text) to authenticated;
grant execute on function public.create_foundation_setup(text, text, text, text, date, text) to authenticated;
grant execute on function public.create_log_entry(uuid, uuid, uuid, text, text, timestamptz, text, jsonb, text) to authenticated;
grant execute on function public.create_manual_sensor_reading(uuid, uuid, uuid, uuid, numeric, timestamptz, text) to authenticated;
grant execute on function public.finalize_photo_capture(uuid, uuid, uuid, text, text, text, text, bigint, text, timestamptz) to authenticated;
