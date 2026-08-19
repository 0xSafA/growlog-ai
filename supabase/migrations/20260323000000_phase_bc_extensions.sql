-- Phase B/C extensions: conversation_id, environmental stats, knowledge sources, grow memory

alter table public.conversation_messages
  add column if not exists conversation_id uuid;

create index if not exists conversation_messages_farm_conversation
  on public.conversation_messages (farm_id, conversation_id, created_at desc)
  where conversation_id is not null;

create table if not exists public.environmental_daily_stats (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  metric_id uuid not null references public.sensor_metrics(id) on delete cascade,
  stat_date date not null,
  min_value numeric not null,
  max_value numeric not null,
  avg_value numeric not null,
  reading_count integer not null default 0,
  last_captured_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (farm_id, scope_id, metric_id, stat_date)
);

create trigger environmental_daily_stats_updated_at
  before update on public.environmental_daily_stats
  for each row execute function public.set_updated_at();

create index if not exists environmental_daily_stats_farm_date
  on public.environmental_daily_stats (farm_id, stat_date desc);

alter table public.environmental_daily_stats enable row level security;
drop policy if exists environmental_daily_stats_all on public.environmental_daily_stats;
create policy environmental_daily_stats_all on public.environmental_daily_stats for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create table if not exists public.knowledge_sources (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid references public.farms(id) on delete cascade,
  slug text not null,
  title text not null,
  description text,
  source_type text not null default 'internal' check (source_type in ('internal', 'external', 'regulatory', 'vendor')),
  is_global boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists knowledge_sources_slug_global
  on public.knowledge_sources (slug) where farm_id is null and is_global = true;

create trigger knowledge_sources_updated_at
  before update on public.knowledge_sources
  for each row execute function public.set_updated_at();

create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.knowledge_sources(id) on delete cascade,
  farm_id uuid references public.farms(id) on delete cascade,
  slug text not null,
  title text not null,
  body text not null,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists knowledge_items_source on public.knowledge_items (source_id);

create trigger knowledge_items_updated_at
  before update on public.knowledge_items
  for each row execute function public.set_updated_at();

alter table public.knowledge_sources enable row level security;
drop policy if exists knowledge_sources_read on public.knowledge_sources;
create policy knowledge_sources_read on public.knowledge_sources for select
  using (is_global = true or farm_id is null or farm_id in (select public.user_farm_ids()));

alter table public.knowledge_items enable row level security;
drop policy if exists knowledge_items_read on public.knowledge_items;
create policy knowledge_items_read on public.knowledge_items for select
  using (
    farm_id is null
    or farm_id in (select public.user_farm_ids())
    or exists (
      select 1 from public.knowledge_sources ks
      where ks.id = knowledge_items.source_id
        and (ks.is_global = true or ks.farm_id is null or ks.farm_id in (select public.user_farm_ids()))
    )
  );

create table if not exists public.grow_memory_items (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  memory_type text not null default 'pattern' check (memory_type in ('pattern', 'preference', 'lesson', 'anomaly_recurrence', 'other')),
  title text not null,
  body text not null,
  confidence numeric(5,4),
  source_event_ids uuid[] not null default '{}',
  valid_from timestamptz,
  valid_to timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists grow_memory_items_farm_cycle
  on public.grow_memory_items (farm_id, cycle_id, created_at desc);

create trigger grow_memory_items_updated_at
  before update on public.grow_memory_items
  for each row execute function public.set_updated_at();

alter table public.grow_memory_items enable row level security;
drop policy if exists grow_memory_items_all on public.grow_memory_items;
create policy grow_memory_items_all on public.grow_memory_items for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create unique index if not exists daily_timelines_scope_date_unique
  on public.daily_timelines (farm_id, scope_id, timeline_date)
  where scope_id is not null;

insert into public.knowledge_sources (id, farm_id, slug, title, description, is_global, source_type)
values (
  'a1000000-0000-4000-8000-000000000001',
  null,
  'growlog-core',
  'Growlog Core Knowledge',
  'Базовые agronomic reference notes for retrieval',
  true,
  'internal'
)
on conflict do nothing;

insert into public.knowledge_items (source_id, farm_id, slug, title, body, tags)
select
  'a1000000-0000-4000-8000-000000000001',
  null,
  v.slug,
  v.title,
  v.body,
  v.tags
from (values
  (
    'vpd-veg',
    'VPD в вегетации',
    'VPD (дефицит давления пара) 0.8–1.2 kPa часто комфортен для вегетации в закрытом помещении. Ниже 0.4 — риск грибка; выше 1.6 — стресс и закрытие устьиц. Всегда сопоставляйте с температурой листа и RH.',
    array['vpd', 'humidity', 'veg']
  ),
  (
    'rh-flower',
    'Влажность на цветении',
    'На раннем цветении RH 45–55% снижает риск плесени на шишках. Резкие скачки RH после полива должны фиксироваться в журнале и сопоставляться с событиями.',
    array['humidity', 'flower', 'mold']
  ),
  (
    'deficiency-yellow',
    'Пожелтение нижних листьев',
    'Пожелтение снизу вверх может быть нормой (senescence) или дефицитом N/Mg. Требуются фото, дата последней подкормки и EC/pH субстрата из журнала — не ставьте диагноз без данных.',
    array['deficiency', 'yellow', 'nutrition']
  )
) as v(slug, title, body, tags)
where not exists (
  select 1 from public.knowledge_items ki where ki.slug = v.slug and ki.farm_id is null
);

insert into public.searchable_documents (farm_id, doc_type, source_id, title, body, metadata)
select
  f.id,
  'knowledge_item',
  ki.id,
  ki.title,
  ki.body,
  jsonb_build_object('slug', ki.slug, 'tags', ki.tags, 'global', true)
from public.farms f
cross join public.knowledge_items ki
where ki.farm_id is null
  and not exists (
    select 1 from public.searchable_documents sd
    where sd.farm_id = f.id and sd.doc_type = 'knowledge_item' and sd.source_id = ki.id
  );

-- Device sensor ingest (service role API — no auth.uid())
create or replace function public.ingest_sensor_device_reading(
  p_device_id uuid,
  p_metric_id uuid,
  p_value numeric,
  p_captured_at timestamptz default now(),
  p_cycle_id uuid default null,
  p_scope_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_device public.sensor_devices;
  v_event public.events;
  v_reading public.sensor_readings;
  v_jobs jsonb;
  v_snapshot_job_id uuid;
  v_cycle_id uuid := p_cycle_id;
  v_scope_id uuid := p_scope_id;
begin
  select * into v_device from public.sensor_devices where id = p_device_id;
  if not found or v_device.status <> 'active' then
    raise exception 'Invalid or inactive device';
  end if;

  perform public.assert_fk_farm_or_global(v_device.farm_id, 'sensor_metrics', p_metric_id, 'ingest.metric_id');

  if v_cycle_id is null then
    select id into v_cycle_id from public.grow_cycles
    where farm_id = v_device.farm_id and status = 'active'
    order by start_date desc limit 1;
  end if;

  if v_scope_id is null and v_cycle_id is not null then
    select id into v_scope_id from public.scopes
    where cycle_id = v_cycle_id and active = true
    order by created_at asc limit 1;
  end if;

  insert into public.events (
    farm_id, cycle_id, scope_id, event_type, body, occurred_at, source_type, payload
  )
  values (
    v_device.farm_id,
    v_cycle_id,
    v_scope_id,
    'sensor_snapshot',
    format('Device reading: %s', p_value),
    p_captured_at,
    'sensor_api',
    jsonb_build_object('metric_id', p_metric_id, 'device_id', p_device_id)
  )
  returning * into v_event;

  insert into public.sensor_readings (
    farm_id, metric_id, cycle_id, scope_id, device_id, captured_at, value_numeric, ingestion_source, raw_payload
  )
  values (
    v_device.farm_id, p_metric_id, v_cycle_id, v_scope_id, p_device_id, p_captured_at, p_value, 'sensor_api', '{}'::jsonb
  )
  returning * into v_reading;

  update public.events set payload = jsonb_build_object(
    'sensor_reading_id', v_reading.id, 'metric_id', p_metric_id, 'device_id', p_device_id
  ) where id = v_event.id;

  insert into public.event_entities (farm_id, event_id, entity_type, entity_id, role)
  values (v_device.farm_id, v_event.id, 'sensor_reading', v_reading.id, 'primary');

  update public.sensor_devices set last_seen_at = p_captured_at, updated_at = now() where id = p_device_id;

  v_jobs := public.enqueue_standard_event_jobs(
    v_device.farm_id, v_cycle_id, v_scope_id, v_event.id, p_captured_at, 'high'
  );

  v_snapshot_job_id := public.enqueue_background_job(
    'snapshot.refresh', v_device.farm_id, 'high', v_cycle_id, v_scope_id,
    'sensor_reading', v_reading.id, now(),
    format('snapshot.refresh:%s:%s', coalesce(v_scope_id::text, 'none'), date_trunc('hour', p_captured_at)),
    v_event.id::text,
    jsonb_build_object('sensor_reading_id', v_reading.id, 'captured_at', p_captured_at)
  );

  return jsonb_build_object(
    'event', to_jsonb(v_event),
    'reading', to_jsonb(v_reading),
    'jobs', v_jobs || jsonb_build_object('snapshot_refresh_job_id', v_snapshot_job_id)
  );
end;
$$;

grant execute on function public.ingest_sensor_device_reading(uuid, uuid, numeric, timestamptz, uuid, uuid) to service_role;
