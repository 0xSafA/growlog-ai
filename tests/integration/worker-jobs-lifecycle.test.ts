import { describe, expect, it } from 'vitest';
import {
  claimBackgroundJob,
  completeBackgroundJob,
  createServiceRoleSupabase,
  failBackgroundJob,
} from '@/lib/growlog/background-worker-core';
import { createAnonClient, integrationEnvReady } from './helpers';

const describeIntegration = integrationEnvReady() ? describe : describe.skip;

describeIntegration('background_jobs worker RPC lifecycle (service role)', () => {
  it('claims a pending job, completes it, row is succeeded', async () => {
    const supabase = createServiceRoleSupabase();
    const workerId = `test-worker-${Date.now()}`;

    const { data: farm, error: farmErr } = await supabase
      .from('farms')
      .insert({ name: `vitest farm ${Date.now()}`, timezone: 'UTC' })
      .select('id')
      .single();
    expect(farmErr).toBeNull();
    expect(farm?.id).toBeTruthy();

    const { data: jobInsert, error: insErr } = await supabase
      .from('background_jobs')
      .insert({
        farm_id: farm!.id,
        job_type: 'document.index',
        status: 'pending',
        priority: 'normal',
        scheduled_for: new Date().toISOString(),
        payload_json: { test: true },
      })
      .select('id')
      .single();
    expect(insErr).toBeNull();
    expect(jobInsert?.id).toBeTruthy();

    const claimed = await claimBackgroundJob(supabase, {
      workerId,
      jobType: 'document.index',
    });
    expect(claimed?.id).toBe(jobInsert!.id);
    expect(claimed?.status).toBe('running');

    const done = await completeBackgroundJob(supabase, jobInsert!.id, workerId, {
      ok: true,
    });
    expect(done.status).toBe('succeeded');
    expect(done.finished_at).toBeTruthy();

    await supabase.from('farms').delete().eq('id', farm!.id);
  });

  it('fails a running job with retry schedules retrying', async () => {
    const supabase = createServiceRoleSupabase();
    const workerId = `test-worker-retry-${Date.now()}`;

    const { data: farm } = await supabase
      .from('farms')
      .insert({ name: `vitest farm retry ${Date.now()}`, timezone: 'UTC' })
      .select('id')
      .single();

    const { data: jobRow } = await supabase
      .from('background_jobs')
      .insert({
        farm_id: farm!.id,
        job_type: 'focus.refresh',
        status: 'pending',
        priority: 'low',
        scheduled_for: new Date().toISOString(),
        payload_json: {},
      })
      .select('id')
      .single();

    await claimBackgroundJob(supabase, { workerId, jobType: 'focus.refresh' });

    const retried = await failBackgroundJob(
      supabase,
      jobRow!.id,
      workerId,
      'forced_retry',
      1
    );
    expect(retried.status).toBe('retrying');
    expect(retried.scheduled_for).toBeTruthy();

    await supabase.from('background_jobs').delete().eq('id', jobRow!.id);
    await supabase.from('farms').delete().eq('id', farm!.id);
  });
});

describeIntegration('claim_background_job is not callable as anon JWT', () => {
  it('rejects anonymous client', async () => {
    const anon = createAnonClient();
    const { error } = await anon.rpc('claim_background_job', {
      p_worker_id: 'nope',
      p_job_type: null,
      p_farm_id: null,
    });
    expect(error).toBeTruthy();
  });
});
