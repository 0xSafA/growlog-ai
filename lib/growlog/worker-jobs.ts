import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import {
  claimBackgroundJob as claimBackgroundJobCore,
  completeBackgroundJob as completeBackgroundJobCore,
  failBackgroundJob as failBackgroundJobCore,
  heartbeatBackgroundJob as heartbeatBackgroundJobCore,
  markBackgroundJobStale as markBackgroundJobStaleCore,
} from '@/lib/growlog/background-worker-core';
export async function claimBackgroundJob(params: {
  workerId: string;
  jobType?: string | null;
  farmId?: string | null;
}) {
  return claimBackgroundJobCore(createAdminClient(), params);
}

export async function heartbeatBackgroundJob(jobId: string, workerId: string) {
  return heartbeatBackgroundJobCore(createAdminClient(), jobId, workerId);
}

export async function completeBackgroundJob(
  jobId: string,
  workerId: string,
  resultJson: Record<string, unknown> = {}
) {
  return completeBackgroundJobCore(createAdminClient(), jobId, workerId, resultJson);
}

export async function failBackgroundJob(
  jobId: string,
  workerId: string,
  lastError: string,
  retryDelaySeconds?: number | null
) {
  return failBackgroundJobCore(createAdminClient(), jobId, workerId, lastError, retryDelaySeconds);
}

export async function markBackgroundJobStale(jobId: string, workerId: string, reason?: string) {
  return markBackgroundJobStaleCore(createAdminClient(), jobId, workerId, reason);
}
