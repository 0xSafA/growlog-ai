import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { BackgroundJobRow } from '@/types/background-jobs';

/** Service-role client for workers and integration tests (not `server-only`). */
export function createServiceRoleSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function claimBackgroundJob(
  supabase: SupabaseClient,
  params: {
    workerId: string;
    jobType?: string | null;
    farmId?: string | null;
  }
): Promise<BackgroundJobRow | null> {
  const { data, error } = await supabase.rpc('claim_background_job', {
    p_worker_id: params.workerId,
    p_job_type: params.jobType ?? null,
    p_farm_id: params.farmId ?? null,
  });
  if (error) throw error;
  return ((data as BackgroundJobRow[] | null) ?? [])[0] ?? null;
}

export async function heartbeatBackgroundJob(
  supabase: SupabaseClient,
  jobId: string,
  workerId: string
) {
  const { error } = await supabase.rpc('heartbeat_background_job', {
    p_job_id: jobId,
    p_worker_id: workerId,
  });
  if (error) throw error;
}

export async function completeBackgroundJob(
  supabase: SupabaseClient,
  jobId: string,
  workerId: string,
  resultJson: Record<string, unknown> = {}
) {
  const { data, error } = await supabase.rpc('complete_background_job', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_result_json: resultJson,
  });
  if (error) throw error;
  return data as BackgroundJobRow;
}

export async function failBackgroundJob(
  supabase: SupabaseClient,
  jobId: string,
  workerId: string,
  lastError: string,
  retryDelaySeconds?: number | null
) {
  const { data, error } = await supabase.rpc('fail_background_job', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_last_error: lastError,
    p_retry_delay_seconds: retryDelaySeconds ?? null,
  });
  if (error) throw error;
  return data as BackgroundJobRow;
}

export async function markBackgroundJobStale(
  supabase: SupabaseClient,
  jobId: string,
  workerId: string,
  reason?: string
) {
  const { data, error } = await supabase.rpc('mark_background_job_stale', {
    p_job_id: jobId,
    p_worker_id: workerId,
    p_reason: reason ?? 'stale',
  });
  if (error) throw error;
  return data as BackgroundJobRow;
}
