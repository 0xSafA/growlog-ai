import { describe, expect, it } from 'vitest';
import { createAnonClient, createServiceRoleSupabase, createUserClient, integrationEnvReady } from './helpers';

const describeIntegration = integrationEnvReady() ? describe : describe.skip;
const token = process.env.INTEGRATION_TEST_ACCESS_TOKEN?.trim();
const describeWithUserJwt = integrationEnvReady() && token ? describe : describe.skip;

describeWithUserJwt('RLS: tenant isolation for events insert', () => {
  it('authenticated user cannot insert event for arbitrary farm_id', async () => {
    const userClient = createUserClient(token!);
    const fakeFarm = '00000000-0000-4000-8000-000000000001';

    // `external_sync` allows null cycle/scope per events_context; RLS should still block wrong farm.
    const { error } = await userClient.from('events').insert({
      farm_id: fakeFarm,
      cycle_id: null,
      scope_id: null,
      event_type: 'external_sync',
      body: 'x',
      occurred_at: new Date().toISOString(),
      source_type: 'user_text',
      payload: {},
    });

    expect(error).toBeTruthy();
  });
});

describeIntegration('Use case RPC: create_log_entry requires membership', () => {
  it('rejects unauthenticated', async () => {
    const anon = createAnonClient();
    const { error } = await anon.rpc('create_log_entry', {
      p_farm_id: '00000000-0000-4000-8000-000000000002',
      p_cycle_id: '00000000-0000-4000-8000-000000000003',
      p_scope_id: '00000000-0000-4000-8000-000000000004',
      p_event_type: 'note',
      p_body: 'hi',
      p_occurred_at: new Date().toISOString(),
      p_source_type: 'user_text',
      p_payload: {},
      p_title: null,
    });
    expect(error).toBeTruthy();
  });
});

describeWithUserJwt('Use case RPC: create_log_entry with JWT', () => {
  it('invalid farm_id is rejected', async () => {
    const userClient = createUserClient(token!);
    const { error } = await userClient.rpc('create_log_entry', {
      p_farm_id: '00000000-0000-4000-8000-000000000005',
      p_cycle_id: '00000000-0000-4000-8000-000000000006',
      p_scope_id: '00000000-0000-4000-8000-000000000007',
      p_event_type: 'note',
      p_body: 'hi',
      p_occurred_at: new Date().toISOString(),
      p_source_type: 'user_text',
      p_payload: {},
      p_title: null,
    });
    expect(error).toBeTruthy();
  });
});

describeIntegration('enqueue_background_job: not service role, must be member', () => {
  it('anon cannot enqueue', async () => {
    const anon = createAnonClient();
    const { error } = await anon.rpc('enqueue_background_job', {
      p_job_type: 'document.index',
      p_farm_id: '00000000-0000-4000-8000-000000000008',
      p_priority: 'normal',
      p_cycle_id: null,
      p_scope_id: null,
      p_entity_type: null,
      p_entity_id: null,
      p_scheduled_for: new Date().toISOString(),
      p_dedup_key: null,
      p_correlation_id: null,
      p_payload_json: {},
    });
    expect(error).toBeTruthy();
  });
});

/** Smoke: service role can still read farms after migrations (sanity). */
describeIntegration('Service role sanity', () => {
  it('can list farms table', async () => {
    const supabase = createServiceRoleSupabase();
    const { error } = await supabase.from('farms').select('id').limit(1);
    expect(error).toBeNull();
  });
});
