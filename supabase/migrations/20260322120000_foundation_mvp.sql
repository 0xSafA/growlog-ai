-- Growlog AI — Foundation MVP (ADR-001 / ADR-002 subset)
-- Run in Supabase SQL editor or via CLI.

create extension if not exists pgcrypto;

-- ─── ORG / FARM ─────────────────────────────────────────────────────────────

create table public.farms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  timezone text not null default 'UTC',
  country text,
  city text,
  settings jsonb not null default '{}'::jsonb,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.farm_users (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('grower', 'manager', 'admin', 'viewer')),
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, user_id)
);

create table public.farm_sites (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  name text not null,
  site_type text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.farm_zones (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  site_id uuid references public.farm_sites(id) on delete set null,
  parent_zone_id uuid references public.farm_zones(id) on delete set null,
  name text not null,
  zone_type text not null check (zone_type in (
    'room', 'tent', 'rack', 'table', 'drying_room', 'mother_room', 'other'
  )),
  code text,
  capacity jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── GROW ───────────────────────────────────────────────────────────────────

create table public.grow_cycles (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  site_id uuid references public.farm_sites(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  name text not null,
  cultivar_name text,
  batch_code text,
  start_date date not null,
  end_date date,
  status text not null check (status in ('planned', 'active', 'harvested', 'archived', 'cancelled')),
  stage text not null check (stage in (
    'propagation', 'veg', 'flower', 'drying', 'curing', 'completed'
  )),
  goal_profile jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plant_groups (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete cascade,
  zone_id uuid references public.farm_zones(id) on delete set null,
  name text not null,
  group_type text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plants (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  plant_code text not null,
  cultivar_name text,
  phenotype text,
  source_type text,
  source_reference text,
  start_date date,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.scopes (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete cascade,
  parent_scope_id uuid references public.scopes(id) on delete set null,
  scope_type text not null check (scope_type in (
    'farm', 'site', 'room', 'tent', 'zone', 'bed', 'reservoir', 'plant_group', 'plant'
  )),
  display_name text not null,
  site_id uuid references public.farm_sites(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  plant_group_id uuid references public.plant_groups(id) on delete set null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── EVENT SPINE ───────────────────────────────────────────────────────────

create table public.events (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  site_id uuid references public.farm_sites(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  plant_group_id uuid references public.plant_groups(id) on delete set null,
  event_type text not null,
  event_subtype text,
  title text,
  body text,
  occurred_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  source_type text not null,
  source_ref text,
  severity text check (severity is null or severity in ('info', 'warning', 'critical')),
  status text,
  tags text[] not null default '{}',
  payload jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_context check (
    cycle_id is not null
    or scope_id is not null
    or event_type in ('external_sync', 'report_generated')
  ),
  constraint events_event_type check (
    event_type in (
      'note', 'observation', 'action_taken', 'watering', 'feeding', 'pruning', 'training',
      'transplant', 'issue_detected', 'pest_detected', 'deficiency_suspected', 'stage_changed',
      'harvest', 'drying', 'curing', 'sensor_snapshot', 'photo_capture', 'sop_due',
      'sop_executed', 'sop_missed', 'ai_analysis', 'anomaly', 'report_generated', 'conversation_turn',
      'external_sync'
    )
  ),
  constraint events_source_type check (
    source_type in (
      'user_text', 'user_voice', 'user_form', 'sensor_api', 'file_upload',
      'internal_system', 'ai_generated', 'imported'
    )
  )
);

create table public.event_entities (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  entity_type text not null check (entity_type in (
    'photo', 'sensor_reading', 'sop_execution', 'insight', 'report', 'conversation_message'
  )),
  entity_id uuid not null,
  role text check (role is null or role in ('primary', 'attachment', 'evidence', 'output', 'trigger')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── SENSORS (manual + future devices) ─────────────────────────────────────

create table public.sensor_metrics (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references public.farms(id) on delete cascade,
  metric_code text not null,
  name text not null,
  unit text,
  category text not null check (category in (
    'climate', 'nutrient', 'irrigation', 'light', 'substrate', 'water', 'power'
  )),
  normal_range jsonb,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index sensor_metrics_global_code on public.sensor_metrics (metric_code)
  where farm_id is null;

create unique index sensor_metrics_farm_code on public.sensor_metrics (farm_id, metric_code)
  where farm_id is not null;

create table public.sensor_readings (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  device_id uuid,
  metric_id uuid references public.sensor_metrics(id) on delete set null,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  captured_at timestamptz not null,
  value_numeric numeric not null,
  value_text text,
  unit text,
  quality_score numeric(5,4),
  ingestion_source text not null,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─── MEDIA ───────────────────────────────────────────────────────────────────

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  zone_id uuid references public.farm_zones(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  plant_id uuid references public.plants(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  storage_bucket text not null,
  storage_path text not null,
  media_type text not null check (media_type in ('image', 'audio', 'pdf', 'html_snapshot')),
  mime_type text not null,
  file_name text,
  file_size bigint,
  width integer,
  height integer,
  duration_seconds numeric,
  captured_at timestamptz,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (storage_bucket, storage_path)
);

-- ─── TRIGGERS: updated_at ────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger farms_updated_at before update on public.farms
  for each row execute function public.set_updated_at();
create trigger farm_users_updated_at before update on public.farm_users
  for each row execute function public.set_updated_at();
create trigger farm_sites_updated_at before update on public.farm_sites
  for each row execute function public.set_updated_at();
create trigger farm_zones_updated_at before update on public.farm_zones
  for each row execute function public.set_updated_at();
create trigger grow_cycles_updated_at before update on public.grow_cycles
  for each row execute function public.set_updated_at();
create trigger plant_groups_updated_at before update on public.plant_groups
  for each row execute function public.set_updated_at();
create trigger plants_updated_at before update on public.plants
  for each row execute function public.set_updated_at();
create trigger scopes_updated_at before update on public.scopes
  for each row execute function public.set_updated_at();
create trigger events_updated_at before update on public.events
  for each row execute function public.set_updated_at();
create trigger event_entities_updated_at before update on public.event_entities
  for each row execute function public.set_updated_at();
create trigger sensor_metrics_updated_at before update on public.sensor_metrics
  for each row execute function public.set_updated_at();
create trigger media_assets_updated_at before update on public.media_assets
  for each row execute function public.set_updated_at();

-- ─── SEED: global sensor metrics ─────────────────────────────────────────────

insert into public.sensor_metrics (farm_id, metric_code, name, unit, category, description) values
  (null, 'temp_air', 'Air temperature', '°C', 'climate', null),
  (null, 'rh', 'Relative humidity', '%', 'climate', null),
  (null, 'vpd', 'VPD', 'kPa', 'climate', null),
  (null, 'ph', 'pH', null, 'nutrient', null),
  (null, 'ec', 'EC', 'mS/cm', 'nutrient', null),
  (null, 'ppm', 'PPM', 'ppm', 'nutrient', null),
  (null, 'runoff_ph', 'Runoff pH', null, 'irrigation', null),
  (null, 'runoff_ec', 'Runoff EC', 'mS/cm', 'irrigation', null),
  (null, 'co2', 'CO₂', 'ppm', 'climate', null);

-- ─── RLS ───────────────────────────────────────────────────────────────────

alter table public.farms enable row level security;
alter table public.farm_users enable row level security;
alter table public.farm_sites enable row level security;
alter table public.farm_zones enable row level security;
alter table public.grow_cycles enable row level security;
alter table public.plant_groups enable row level security;
alter table public.plants enable row level security;
alter table public.scopes enable row level security;
alter table public.events enable row level security;
alter table public.event_entities enable row level security;
alter table public.sensor_metrics enable row level security;
alter table public.sensor_readings enable row level security;
alter table public.media_assets enable row level security;

-- Helper: membership
create or replace function public.user_farm_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select farm_id from public.farm_users where user_id = auth.uid();
$$;

-- farms: создание только через create_farm_with_membership (security definer)
create policy farms_select on public.farms for select
  using (id in (select public.user_farm_ids()));

create policy farms_insert on public.farms for insert
  with check (false);

create policy farms_update on public.farms for update
  using (id in (select public.user_farm_ids()));

create policy farms_delete on public.farms for delete
  using (id in (select public.user_farm_ids()));

-- farm_users: строки добавляет только RPC/сервис (при создании фермы и т.д.)
create policy farm_users_select on public.farm_users for select
  using (farm_id in (select public.user_farm_ids()));

create policy farm_users_insert on public.farm_users for insert
  with check (false);

create policy farm_users_update on public.farm_users for update
  using (farm_id in (select public.user_farm_ids()));

create policy farm_users_delete on public.farm_users for delete
  using (farm_id in (select public.user_farm_ids()));

-- Remaining tables: same pattern
create policy farm_sites_all on public.farm_sites for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy farm_zones_all on public.farm_zones for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy grow_cycles_all on public.grow_cycles for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy plant_groups_all on public.plant_groups for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy plants_all on public.plants for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy scopes_all on public.scopes for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy events_all on public.events for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy event_entities_all on public.event_entities for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

-- Global + farm-specific metrics readable
create policy sensor_metrics_select on public.sensor_metrics for select
  using (farm_id is null or farm_id in (select public.user_farm_ids()));

create policy sensor_metrics_insert on public.sensor_metrics for insert
  with check (farm_id in (select public.user_farm_ids()));

create policy sensor_metrics_update on public.sensor_metrics for update
  using (farm_id in (select public.user_farm_ids()));

create policy sensor_readings_all on public.sensor_readings for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy media_assets_all on public.media_assets for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

-- Service role bypasses RLS by default in Supabase.

-- ─── Storage bucket for photos ─────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('media', 'media', false)
on conflict (id) do nothing;

create policy media_objects_select on storage.objects for select
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (select farm_id::text from public.farm_users where user_id = auth.uid())
  );

create policy media_objects_insert on storage.objects for insert
  with check (
    bucket_id = 'media'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] in (select farm_id::text from public.farm_users where user_id = auth.uid())
  );

create policy media_objects_update on storage.objects for update
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (select farm_id::text from public.farm_users where user_id = auth.uid())
  );

create policy media_objects_delete on storage.objects for delete
  using (
    bucket_id = 'media'
    and (storage.foldername(name))[1] in (select farm_id::text from public.farm_users where user_id = auth.uid())
  );

-- ─── Bootstrap: link creator as admin after farm insert (optional RPC) ─────

create or replace function public.create_farm_with_membership(
  p_name text,
  p_timezone text default 'UTC'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_farm_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.farms (name, timezone)
  values (p_name, coalesce(nullif(trim(p_timezone), ''), 'UTC'))
  returning id into v_farm_id;

  insert into public.farm_users (farm_id, user_id, role)
  values (v_farm_id, auth.uid(), 'admin');

  return v_farm_id;
end;
$$;

grant execute on function public.create_farm_with_membership(text, text) to authenticated;
grant execute on function public.user_farm_ids() to authenticated;
