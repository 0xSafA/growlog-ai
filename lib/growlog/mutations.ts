import type { SupabaseClient } from '@supabase/supabase-js';
import type { EventType, SourceType } from '@/types/domain';
import type { FarmRole } from '@/types/farm';

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
  const { farmId, name, cultivarName, startDate, stage } = params;
  const { data, error } = await supabase.rpc('create_cycle_with_default_scope', {
    p_farm_id: farmId,
    p_name: name,
    p_cultivar_name: cultivarName ?? null,
    p_start_date: startDate,
    p_stage: stage,
  });
  if (error) throw error;
  const payload = data as { cycle: Record<string, unknown>; scope: Record<string, unknown> };
  return { cycle: payload.cycle, scope: payload.scope };
}

export async function createFoundationSetup(
  supabase: SupabaseClient,
  params: {
    farmName: string;
    timezone: string;
    cycleName: string;
    cultivarName?: string;
    startDate: string;
    stage: string;
  }
) {
  const { data, error } = await supabase.rpc('create_foundation_setup', {
    p_farm_name: params.farmName,
    p_timezone: params.timezone,
    p_cycle_name: params.cycleName,
    p_cultivar_name: params.cultivarName ?? null,
    p_start_date: params.startDate,
    p_stage: params.stage,
  });
  if (error) throw error;
  return data as {
    farm_id: string;
    cycle: Record<string, unknown>;
    scope: Record<string, unknown>;
  };
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
  const { data, error } = await supabase.rpc('create_log_entry', {
    p_farm_id: params.farmId,
    p_cycle_id: params.cycleId,
    p_scope_id: params.scopeId,
    p_event_type: params.eventType,
    p_body: params.body,
    p_occurred_at: params.occurredAt,
    p_source_type: params.sourceType,
    p_payload: { ...(params.payload ?? {}) },
    p_title: null,
  });
  if (error) throw error;
  return data as { event: Record<string, unknown>; jobs: Record<string, unknown> };
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

  const path = `${farmId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, '_')}`;

  const { error: upErr } = await supabase.storage.from('media').upload(path, file, {
    cacheControl: '3600',
    upsert: false,
  });
  if (upErr) throw upErr;

  const { data, error } = await supabase.rpc('finalize_photo_capture', {
    p_farm_id: farmId,
    p_cycle_id: cycleId,
    p_scope_id: scopeId,
    p_storage_bucket: 'media',
    p_storage_path: path,
    p_mime_type: file.type || 'image/jpeg',
    p_file_name: file.name,
    p_file_size: file.size,
    p_caption: caption ?? null,
    p_captured_at: occurredAt,
  });
  if (error) {
    await supabase.storage.from('media').remove([path]).catch(() => undefined);
    throw error;
  }

  return data as {
    event: Record<string, unknown>;
    asset: Record<string, unknown>;
    jobs: Record<string, unknown>;
  };
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
  const { data, error } = await supabase.rpc('create_manual_sensor_reading', {
    p_farm_id: params.farmId,
    p_cycle_id: params.cycleId,
    p_scope_id: params.scopeId,
    p_metric_id: params.metricId,
    p_value: params.value,
    p_captured_at: params.capturedAt,
    p_unit: params.unit,
  });
  if (error) throw error;
  return data as {
    event: Record<string, unknown>;
    reading: Record<string, unknown>;
    jobs: Record<string, unknown>;
  };
}

/** ADR-009: only farm admins (via RPC). */
export async function setFarmUserRole(
  supabase: SupabaseClient,
  params: { farmId: string; userId: string; role: FarmRole }
) {
  const { error } = await supabase.rpc('set_farm_user_role', {
    p_farm_id: params.farmId,
    p_user_id: params.userId,
    p_role: params.role,
  });
  if (error) throw error;
}

/** ADR-009: only farm admins (via RPC). */
export async function addFarmUserMembership(
  supabase: SupabaseClient,
  params: { farmId: string; userId: string; role: FarmRole }
) {
  const { data, error } = await supabase.rpc('add_farm_user_membership', {
    p_farm_id: params.farmId,
    p_user_id: params.userId,
    p_role: params.role,
  });
  if (error) throw error;
  return data as string;
}
