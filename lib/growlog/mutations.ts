import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventType, SourceType } from '@/types/domain';

export async function createFarm(supabase: SupabaseClient, name: string, timezone: string) {
  const { data, error } = await supabase.rpc('create_farm_with_membership', {
    p_name: name,
    p_timezone: timezone,
  });
  if (error) throw error;
  return data as string;
}

export async function createCycleWithDefaultScope(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    name: string;
    cultivarName?: string;
    startDate: string;
    stage: string;
    createdBy?: string | null;
  }
) {
  const { farmId, name, cultivarName, startDate, stage, createdBy } = params;
  const { data: cycle, error: cErr } = await supabase
    .from('grow_cycles')
    .insert({
      farm_id: farmId,
      name,
      cultivar_name: cultivarName ?? null,
      start_date: startDate,
      status: 'active',
      stage,
      created_by: createdBy ?? null,
    })
    .select()
    .single();
  if (cErr) throw cErr;

  const { data: scope, error: sErr } = await supabase
    .from('scopes')
    .insert({
      farm_id: farmId,
      cycle_id: cycle.id,
      scope_type: 'tent',
      display_name: 'Main',
    })
    .select()
    .single();
  if (sErr) throw sErr;

  return { cycle, scope };
}

export async function createLogEntry(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string;
    scopeId: string;
    eventType: EventType;
    body: string;
    occurredAt: string;
    sourceType: SourceType;
    createdBy?: string | null;
    /** Доп. поля в payload (например voice: { transcript }) — не подменяют факты в body. */
    payload?: Record<string, unknown>;
  }
) {
  const {
    farmId,
    cycleId,
    scopeId,
    eventType,
    body,
    occurredAt,
    sourceType,
    createdBy,
    payload: extraPayload,
  } = params;
  const { data, error } = await supabase
    .from('events')
    .insert({
      farm_id: farmId,
      cycle_id: cycleId,
      scope_id: scopeId,
      event_type: eventType,
      body,
      occurred_at: occurredAt,
      source_type: sourceType,
      payload: { ...(extraPayload ?? {}) },
      created_by: createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createPhotoCaptureEvent(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string;
    scopeId: string;
    file: File;
    caption?: string;
    userId?: string | null;
  }
) {
  const { farmId, cycleId, scopeId, file, caption, userId } = params;
  const occurredAt = new Date().toISOString();

  const { data: ev, error: eErr } = await supabase
    .from('events')
    .insert({
      farm_id: farmId,
      cycle_id: cycleId,
      scope_id: scopeId,
      event_type: 'photo_capture',
      body: caption ?? null,
      occurred_at: occurredAt,
      source_type: 'file_upload',
      payload: {},
      created_by: userId ?? null,
    })
    .select()
    .single();
  if (eErr) throw eErr;

  const path = `${farmId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;

  const { error: upErr } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data: asset, error: aErr } = await supabase
    .from('media_assets')
    .insert({
      farm_id: farmId,
      cycle_id: cycleId,
      scope_id: scopeId,
      uploaded_by: userId ?? null,
      storage_bucket: 'media',
      storage_path: path,
      media_type: 'image',
      mime_type: file.type || 'image/jpeg',
      file_name: file.name,
      file_size: file.size,
      captured_at: occurredAt,
    })
    .select()
    .single();
  if (aErr) throw aErr;

  const { error: u2 } = await supabase
    .from('events')
    .update({ payload: { media_asset_id: asset.id } })
    .eq('id', ev.id);
  if (u2) throw u2;

  const { error: linkErr } = await supabase.from('event_entities').insert({
    farm_id: farmId,
    event_id: ev.id,
    entity_type: 'photo',
    entity_id: asset.id,
    role: 'primary',
  });
  if (linkErr) throw linkErr;

  return { event: { ...ev, payload: { media_asset_id: asset.id } }, asset };
}

export async function createManualSensorReading(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string;
    scopeId: string;
    metricId: string;
    value: number;
    capturedAt: string;
    unit: string | null;
    userId?: string | null;
  }
) {
  const { farmId, cycleId, scopeId, metricId, value, capturedAt, unit, userId } = params;

  const { data: ev, error: eErr } = await supabase
    .from('events')
    .insert({
      farm_id: farmId,
      cycle_id: cycleId,
      scope_id: scopeId,
      event_type: 'sensor_snapshot',
      body: `Manual reading: ${value}${unit ? ` ${unit}` : ''}`,
      occurred_at: capturedAt,
      source_type: 'user_form',
      payload: { metric_id: metricId },
      created_by: userId ?? null,
    })
    .select()
    .single();
  if (eErr) throw eErr;

  const { data: reading, error: rErr } = await supabase
    .from('sensor_readings')
    .insert({
      farm_id: farmId,
      metric_id: metricId,
      cycle_id: cycleId,
      scope_id: scopeId,
      captured_at: capturedAt,
      value_numeric: value,
      unit,
      ingestion_source: 'user_form',
      raw_payload: {},
    })
    .select()
    .single();
  if (rErr) throw rErr;

  const { error: u2 } = await supabase
    .from('events')
    .update({ payload: { sensor_reading_id: reading.id, metric_id: metricId } })
    .eq('id', ev.id);
  if (u2) throw u2;

  const { error: linkErr } = await supabase.from('event_entities').insert({
    farm_id: farmId,
    event_id: ev.id,
    entity_type: 'sensor_reading',
    entity_id: reading.id,
    role: 'primary',
  });
  if (linkErr) throw linkErr;

  return { reading, event: { ...ev, payload: { sensor_reading_id: reading.id, metric_id: metricId } } };
}
