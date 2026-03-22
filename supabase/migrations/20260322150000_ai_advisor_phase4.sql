-- Growlog AI — Phase 4: AI Advisor (ADR-002 / ADR-003 / ADR-004 subset)

-- ─── AI INSIGHTS ─────────────────────────────────────────────────────────────

create table public.ai_insights (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  cycle_id uuid references public.grow_cycles(id) on delete set null,
  scope_id uuid references public.scopes(id) on delete set null,
  insight_type text not null check (insight_type in (
    'summary', 'recommendation', 'causal_explanation', 'clarification_request',
    'evidence_summary', 'pattern', 'risk', 'daily_focus', 'anomaly', 'other'
  )),
  title text,
  body text not null,
  user_query text,
  facts_json jsonb not null default '[]'::jsonb,
  interpretation_json jsonb not null default '{}'::jsonb,
  recommendation_json jsonb not null default '{}'::jsonb,
  hypotheses_json jsonb not null default '[]'::jsonb,
  confidence numeric(5,4),
  confidence_label text check (confidence_label is null or confidence_label in ('low', 'medium', 'high')),
  missing_data_json jsonb not null default '[]'::jsonb,
  trust_flags_json jsonb not null default '[]'::jsonb,
  model_name text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_insights_farm_created on public.ai_insights (farm_id, created_at desc);
create index ai_insights_cycle on public.ai_insights (cycle_id) where cycle_id is not null;

-- ─── INSIGHT GROUNDING ───────────────────────────────────────────────────────

create table public.insight_grounding (
  id uuid primary key default gen_random_uuid(),
  farm_id uuid not null references public.farms(id) on delete cascade,
  insight_id uuid not null references public.ai_insights(id) on delete cascade,
  source_type text not null check (source_type in (
    'event', 'observation', 'sensor_reading', 'sop_run', 'sop_definition',
    'media_asset', 'grow_cycle', 'scope'
  )),
  source_id uuid,
  weight numeric(6,4),
  excerpt text,
  created_at timestamptz not null default now()
);

create index insight_grounding_insight on public.insight_grounding (insight_id);
create index insight_grounding_farm on public.insight_grounding (farm_id);

create trigger ai_insights_updated_at before update on public.ai_insights
  for each row execute function public.set_updated_at();

-- RLS
alter table public.ai_insights enable row level security;
alter table public.insight_grounding enable row level security;

create policy ai_insights_all on public.ai_insights for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));

create policy insight_grounding_all on public.insight_grounding for all
  using (farm_id in (select public.user_farm_ids()))
  with check (farm_id in (select public.user_farm_ids()));
