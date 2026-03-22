/** ADR-008 job contract (background_jobs table + enqueue RPC) */

export const JOB_STATUSES = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'retrying',
  'cancelled',
  'stale',
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const JOB_PRIORITIES = ['critical', 'high', 'normal', 'low'] as const;
export type JobPriority = (typeof JOB_PRIORITIES)[number];

export type BackgroundJobRow = {
  id: string;
  job_type: string;
  status: JobStatus;
  priority: JobPriority;
  farm_id: string;
  cycle_id: string | null;
  scope_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  scheduled_for: string;
  dedup_key: string | null;
  correlation_id: string | null;
  payload_json: Record<string, unknown>;
  attempt_count: number;
  last_error: string | null;
  worker_id: string | null;
  heartbeat_at: string | null;
  result_json: Record<string, unknown>;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
};
