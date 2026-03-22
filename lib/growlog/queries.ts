import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventRow, Farm, GrowCycle, Scope, SensorMetric } from '@/types/database';

export async function fetchFarms(supabase: SupabaseClient): Promise<Farm[]> {
  const { data, error } = await supabase
    .from('farms')
    .select('*')
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as Farm[];
}

export async function fetchActiveCycle(
  supabase: SupabaseClient,
  farmId: string
): Promise<GrowCycle | null> {
  const { data, error } = await supabase
    .from('grow_cycles')
    .select('*')
    .eq('farm_id', farmId)
    .eq('status', 'active')
    .order('start_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data as GrowCycle | null;
}

export async function fetchScopesForCycle(
  supabase: SupabaseClient,
  cycleId: string
): Promise<Scope[]> {
  const { data, error } = await supabase
    .from('scopes')
    .select('*')
    .eq('cycle_id', cycleId)
    .eq('active', true)
    .order('display_name');
  if (error) throw error;
  return (data ?? []) as Scope[];
}

export async function fetchRecentEvents(
  supabase: SupabaseClient,
  params: { farmId: string; cycleId: string; limit?: number }
): Promise<EventRow[]> {
  const { farmId, cycleId, limit = 50 } = params;
  const { data, error } = await supabase
    .from('events')
    .select(
      'id, farm_id, cycle_id, scope_id, event_type, title, body, occurred_at, source_type, payload, created_at'
    )
    .eq('farm_id', farmId)
    .eq('cycle_id', cycleId)
    .order('occurred_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function fetchGlobalSensorMetrics(
  supabase: SupabaseClient
): Promise<SensorMetric[]> {
  const { data, error } = await supabase
    .from('sensor_metrics')
    .select('id, farm_id, metric_code, name, unit, category')
    .is('farm_id', null)
    .order('metric_code');
  if (error) throw error;
  return (data ?? []) as SensorMetric[];
}

export function startOfTodayIso(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export function endOfTodayIso(): string {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.toISOString();
}
