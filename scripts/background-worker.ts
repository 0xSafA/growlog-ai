/**
 * Long-running background worker: claims jobs via service role and completes/fails them.
 *
 * Env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   WORKER_ID (optional, default: hostname-pid)
 *   WORKER_POLL_MS (optional, default: 1000)
 *   WORKER_JOB_TYPE (optional filter for claim_background_job)
 *   WORKER_FARM_ID (optional filter)
 *
 * Run: pnpm worker
 */
import {
  claimBackgroundJob,
  completeBackgroundJob,
  createServiceRoleSupabase,
  failBackgroundJob,
} from '../lib/growlog/background-worker-core';
import {
  processPhotoAnalyzeJob,
  processPhotoTimelineRefreshJob,
} from '../lib/growlog/photo-pipeline';
import { processReportGenerateJob } from '../lib/growlog/report-pipeline';
import type { BackgroundJobRow } from '../types/background-jobs';
import { hostname } from 'node:os';

const pollMs = Math.max(200, Number(process.env.WORKER_POLL_MS || 1000));
const workerId =
  process.env.WORKER_ID?.trim() || `${hostname().split('.')[0]}-${process.pid}`;
const jobTypeFilter = process.env.WORKER_JOB_TYPE?.trim() || null;
const farmIdFilter = process.env.WORKER_FARM_ID?.trim() || null;

let shuttingDown = false;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processJob(
  supabase: ReturnType<typeof createServiceRoleSupabase>,
  job: BackgroundJobRow
): Promise<Record<string, unknown>> {
  switch (job.job_type) {
    case 'photo.analyze':
      return processPhotoAnalyzeJob(supabase, job);
    case 'photo.timeline.refresh':
      return processPhotoTimelineRefreshJob(supabase, job);
    case 'report.generate':
      return processReportGenerateJob(supabase, job);
    case 'document.index':
    case 'timeline.daily.refresh':
    case 'focus.refresh':
    case 'snapshot.refresh':
      return { handled: true, stub: true, job_type: job.job_type };
    default:
      return { handled: true, stub: true, unknown_job_type: job.job_type };
  }
}

async function runLoop() {
  const supabase = createServiceRoleSupabase();
  // eslint-disable-next-line no-console
  console.error(`[growlog-worker] started id=${workerId} pollMs=${pollMs}`);

  while (!shuttingDown) {
    try {
      const job = await claimBackgroundJob(supabase, {
        workerId,
        jobType: jobTypeFilter,
        farmId: farmIdFilter || null,
      });

      if (!job) {
        await sleep(pollMs);
        continue;
      }

      // eslint-disable-next-line no-console
      console.error(`[growlog-worker] claimed ${job.id} type=${job.job_type} farm=${job.farm_id}`);

      try {
        const result = await processJob(supabase, job);
        await completeBackgroundJob(supabase, job.id, workerId, result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // eslint-disable-next-line no-console
        console.error(`[growlog-worker] job ${job.id} error:`, msg);
        await failBackgroundJob(supabase, job.id, workerId, msg, 120);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      // eslint-disable-next-line no-console
      console.error('[growlog-worker] loop error:', msg);
      await sleep(pollMs);
    }
  }
}

process.on('SIGINT', () => {
  shuttingDown = true;
});
process.on('SIGTERM', () => {
  shuttingDown = true;
});

runLoop().catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[growlog-worker] fatal:', e);
  process.exit(1);
});
