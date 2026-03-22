import type { SupabaseClient } from '@supabase/supabase-js';
import type { SopDefinitionRow, SopRunRow } from '@/types/sop';
import { sortSopRunsForDailyFocus } from '@/lib/growlog/sop-engine-pure';

export const SOP_RUNS_QUERY_KEY = 'sop-runs';

export async function fetchSopDefinitions(
  supabase: SupabaseClient,
  farmId: string
): Promise<SopDefinitionRow[]> {
  const { data, error } = await supabase
    .from('sop_definitions')
    .select(
      'id, farm_id, title, description, active, applies_to_scope, instructions_json, required_inputs_after_execution, severity_if_missed'
    )
    .eq('farm_id', farmId)
    .eq('active', true)
    .order('title');
  if (error) throw error;
  return (data ?? []) as SopDefinitionRow[];
}

export async function fetchOpenSopRuns(
  supabase: SupabaseClient,
  params: { farmId: string; cycleId: string }
): Promise<SopRunRow[]> {
  const { farmId, cycleId } = params;
  const { data, error } = await supabase
    .from('sop_runs')
    .select(
      `
      id,
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
      sop_definitions ( title, description, required_inputs_after_execution )
    `
    )
    .eq('farm_id', farmId)
    .eq('cycle_id', cycleId)
    .in('status', ['open', 'acknowledged', 'overdue'])
    .order('due_at', { ascending: true, nullsFirst: false });
  if (error) throw error;
  return sortSopRunsForDailyFocus((data ?? []) as unknown as SopRunRow[]);
}

export async function fetchSopRunById(
  supabase: SupabaseClient,
  runId: string
): Promise<SopRunRow | null> {
  const { data, error } = await supabase
    .from('sop_runs')
    .select(
      `
      id,
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
      sop_definitions ( title, description, required_inputs_after_execution )
    `
    )
    .eq('id', runId)
    .maybeSingle();
  if (error) throw error;
  return data as unknown as SopRunRow | null;
}
