import type { SupabaseClient } from '@supabase/supabase-js';
import type { JobPriority } from '@/types/background-jobs';

/** Enqueue a tenant-scoped background job (ADR-008); uses security definer RPC (ADR-009). */
export async function enqueueBackgroundJob(
  supabase: SupabaseClient,
  params: {
    jobType: string;
    farmId: string;
    priority?: JobPriority;
    cycleId?: string | null;
    scopeId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    scheduledFor?: string;
    dedupKey?: string | null;
    correlationId?: string | null;
    payloadJson?: Record<string, unknown>;
  }
) {
  const {
    jobType,
    farmId,
    priority = 'normal',
    cycleId = null,
    scopeId = null,
    entityType = null,
    entityId = null,
    scheduledFor,
    dedupKey = null,
    correlationId = null,
    payloadJson = {},
  } = params;

  const { data, error } = await supabase.rpc('enqueue_background_job', {
    p_job_type: jobType,
    p_farm_id: farmId,
    p_priority: priority,
    p_cycle_id: cycleId,
    p_scope_id: scopeId,
    p_entity_type: entityType,
    p_entity_id: entityId,
    p_scheduled_for: scheduledFor ?? new Date().toISOString(),
    p_dedup_key: dedupKey,
    p_correlation_id: correlationId,
    p_payload_json: payloadJson,
  });
  if (error) throw error;
  return data as string;
}
