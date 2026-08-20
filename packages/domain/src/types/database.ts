export type Farm = {
  id: string;
  name: string;
  slug: string | null;
  timezone: string;
  country: string | null;
  city: string | null;
  settings: Record<string, unknown>;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
};

export type GrowCycle = {
  id: string;
  farm_id: string;
  site_id: string | null;
  zone_id: string | null;
  name: string;
  cultivar_name: string | null;
  batch_code: string | null;
  start_date: string;
  end_date: string | null;
  status: string;
  stage: string;
  goal_profile: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Scope = {
  id: string;
  farm_id: string;
  cycle_id: string | null;
  parent_scope_id: string | null;
  scope_type: string;
  display_name: string;
  site_id: string | null;
  zone_id: string | null;
  plant_id: string | null;
  plant_group_id: string | null;
  active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type EventRow = {
  id: string;
  farm_id: string;
  cycle_id: string | null;
  scope_id: string | null;
  event_type: string;
  title: string | null;
  body: string | null;
  occurred_at: string;
  source_type: string;
  payload: Record<string, unknown>;
  created_at: string;
};

export type SensorMetric = {
  id: string;
  farm_id: string | null;
  metric_code: string;
  name: string;
  unit: string | null;
  category: string;
};
