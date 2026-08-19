import type { NextApiRequest, NextApiResponse } from 'next';
import { createServiceRoleSupabase } from '@/lib/growlog/background-worker-core';

type IngestBody = {
  deviceId?: string;
  metricCode?: string;
  value?: number;
  capturedAt?: string;
  cycleId?: string | null;
  scopeId?: string | null;
};

function getIngestToken(req: NextApiRequest): string | null {
  const h = req.headers['x-sensor-token'];
  if (typeof h === 'string' && h.trim()) return h.trim();
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const token = getIngestToken(req);
  if (!token) {
    return res.status(401).json({ error: 'missing_sensor_token' });
  }

  const body = req.body as IngestBody;
  const deviceId = typeof body.deviceId === 'string' ? body.deviceId.trim() : '';
  const metricCode = typeof body.metricCode === 'string' ? body.metricCode.trim() : '';
  const value = typeof body.value === 'number' ? body.value : Number(body.value);

  if (!deviceId || !metricCode || Number.isNaN(value)) {
    return res.status(400).json({ error: 'invalid_payload' });
  }

  const supabase = createServiceRoleSupabase();

  const { data: device, error: devErr } = await supabase
    .from('sensor_devices')
    .select('id, farm_id, status, config')
    .eq('id', deviceId)
    .maybeSingle();
  if (devErr) return res.status(500).json({ error: 'device_lookup_failed' });
  if (!device || device.status !== 'active') {
    return res.status(404).json({ error: 'device_not_found' });
  }

  const deviceToken =
    (device.config as Record<string, unknown> | null)?.ingest_token ??
    (device.config as Record<string, unknown> | null)?.ingestToken;
  const globalSecret = process.env.SENSOR_INGEST_SECRET?.trim();
  const tokenOk =
    (typeof deviceToken === 'string' && deviceToken === token) ||
    (globalSecret && globalSecret === token);
  if (!tokenOk) {
    return res.status(403).json({ error: 'invalid_sensor_token' });
  }

  const { data: metric, error: metErr } = await supabase
    .from('sensor_metrics')
    .select('id')
    .eq('metric_code', metricCode)
    .maybeSingle();
  if (metErr) return res.status(500).json({ error: 'metric_lookup_failed' });
  if (!metric?.id) return res.status(400).json({ error: 'unknown_metric_code' });

  let cycleId =
    body.cycleId === null || body.cycleId === undefined || body.cycleId === ''
      ? null
      : body.cycleId;
  let scopeId =
    body.scopeId === null || body.scopeId === undefined || body.scopeId === ''
      ? null
      : body.scopeId;

  if (!cycleId) {
    const { data: cycle } = await supabase
      .from('grow_cycles')
      .select('id')
      .eq('farm_id', device.farm_id)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    cycleId = cycle?.id ?? null;
  }

  if (!scopeId && cycleId) {
    const { data: scope } = await supabase
      .from('scopes')
      .select('id')
      .eq('cycle_id', cycleId)
      .eq('active', true)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    scopeId = scope?.id ?? null;
  }

  const capturedAt =
    typeof body.capturedAt === 'string' && body.capturedAt.trim()
      ? body.capturedAt.trim()
      : new Date().toISOString();

  const { data, error } = await supabase.rpc('ingest_sensor_device_reading', {
    p_device_id: device.id,
    p_metric_id: metric.id,
    p_value: value,
    p_captured_at: capturedAt,
    p_cycle_id: cycleId,
    p_scope_id: scopeId,
  });

  if (error) {
    return res.status(500).json({ error: 'ingest_failed', detail: error.message });
  }

  return res.status(201).json({ ok: true, result: data });
}
