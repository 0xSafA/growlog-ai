-- ADR-010: Photo Intelligence — entity statuses, timeline signals, report media selections

-- ─── media_assets: analysis lifecycle (entity-level, not AI output) ───────────

alter table public.media_assets
  add column if not exists analysis_status text not null default 'saved_unanalyzed'
    check (analysis_status in (
      'saved_unanalyzed',
      'processing_analysis',
      'analysis_ready',
      'analysis_failed'
    ));

comment on column public.media_assets.analysis_status is
  'ADR-010: raw media lifecycle for vision pipeline (not model interpretation).';

-- Align statuses for images that already had photo_analysis before this column existed
update public.media_assets m
set analysis_status = 'analysis_ready'
where m.media_type = 'image'
  and m.analysis_status = 'saved_unanalyzed'
  and exists (
    select 1
    from public.photo_analysis pa
    where pa.media_asset_id = m.id
      and pa.farm_id = m.farm_id
  );

-- ─── photo_timeline_signals: derived temporal hypotheses between frames ───────

create table public.photo_timeline_signals (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  from_media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  to_media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  signal_type text not null check (signal_type in (
    'color_shift',
    'leaf_drop',
    'growth_change',
    'density_change',
    'suspected_stress',
    'general'
  )),
  signal_strength numeric(5,4),
  description text,
  correlated_factors jsonb not null default '{}'::jsonb,
  analysis_version text not null default 'v1',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_timeline_temporal_order check (from_media_asset_id <> to_media_asset_id)
);

create trigger photo_timeline_signals_updated_at
  before update on public.photo_timeline_signals
  for each row execute function public.set_updated_at();

create unique index if not exists photo_timeline_pair_unique
  on public.photo_timeline_signals (farm_id, from_media_asset_id, to_media_asset_id);

create index if not exists photo_timeline_farm_scope_captured
  on public.photo_timeline_signals (farm_id, scope_id, created_at desc)
  where scope_id is not null;

drop trigger if exists photo_timeline_signals_validate_farm_refs on public.photo_timeline_signals;
create trigger photo_timeline_signals_validate_farm_refs
  before insert or update on public.photo_timeline_signals
  for each row execute function public.validate_referenced_farms(
    'cycle_id', 'grow_cycles',
    'zone_id', 'farm_zones',
    'scope_id', 'scopes',
    'plant_id', 'plants',
    'from_media_asset_id', 'media_assets',
    'to_media_asset_id', 'media_assets'
  );

alter table public.photo_timeline_signals enable row level security;

create policy photo_timeline_signals_all on public.photo_timeline_signals
  for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

-- ─── report_media_selections: curated visuals (ADR-007 / ADR-010) ─────────────

create table public.report_media_selections (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  report_id uuid not null references public.reports(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  selection_reason text,
  layout_role text not null default 'evidence' check (layout_role in (
    'hero', 'evidence', 'collage', 'appendix', 'hidden_gallery'
  )),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger report_media_selections_updated_at
  before update on public.report_media_selections
  for each row execute function public.set_updated_at();

create unique index if not exists report_media_selections_report_asset_unique
  on public.report_media_selections (report_id, media_asset_id);

drop trigger if exists report_media_selections_validate_farm_refs on public.report_media_selections;
create trigger report_media_selections_validate_farm_refs
  before insert or update on public.report_media_selections
  for each row execute function public.validate_referenced_farms(
    'report_id', 'reports',
    'media_asset_id', 'media_assets'
  );

alter table public.report_media_selections enable row level security;

create policy report_media_selections_all on public.report_media_selections
  for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

-- ─── finalize_photo_capture: set initial analysis_status ──────────────────────

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
    captured_at,
    analysis_status
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
    coalesce(p_captured_at, now()),
    'saved_unanalyzed'
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

grant execute on function public.finalize_photo_capture(uuid, uuid, uuid, text, text, text, text, bigint, text, timestamptz) to authenticated;
