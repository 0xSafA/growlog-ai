import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { fromZonedTime } from 'date-fns-tz';
import { getBearerToken, getUserFromBearer } from '@/lib/api/auth-from-request';
import { enqueueBackgroundJob } from '@/lib/growlog/jobs';
import {
  AUDIENCE_TYPES,
  OUTPUT_FORMATS,
  REPORT_TYPES,
  type AudienceType,
  type OutputFormat,
  type ReportType,
} from '@/types/report';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authError } = await getUserFromBearer(req);
  if (!user || authError) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const body = req.body as {
    farmId?: string;
    cycleId?: string;
    scopeId?: string | null;
    reportType?: string;
    audienceType?: string;
    outputFormat?: string;
    startDate?: string;
    endDate?: string;
    title?: string | null;
  };

  if (!body.farmId || !body.cycleId || !body.startDate || !body.endDate) {
    return res.status(400).json({ error: 'missing_params' });
  }

  const reportType = body.reportType as ReportType;
  if (!reportType || !REPORT_TYPES.includes(reportType)) {
    return res.status(400).json({ error: 'invalid_report_type' });
  }

  const audienceType = (body.audienceType || 'internal_operational') as AudienceType;
  if (!AUDIENCE_TYPES.includes(audienceType)) {
    return res.status(400).json({ error: 'invalid_audience_type' });
  }

  const outputFormat = (body.outputFormat || 'html') as OutputFormat;
  if (!OUTPUT_FORMATS.includes(outputFormat)) {
    return res.status(400).json({ error: 'invalid_output_format' });
  }

  const startD = body.startDate.trim();
  const endD = body.endDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startD) || !/^\d{4}-\d{2}-\d{2}$/.test(endD)) {
    return res.status(400).json({ error: 'invalid_date_format' });
  }

  const { data: farm, error: farmErr } = await supabase
    .from('farms')
    .select('timezone')
    .eq('id', body.farmId)
    .single();
  if (farmErr || !farm) {
    return res.status(404).json({ error: 'farm_not_found' });
  }

  const tz = farm.timezone?.trim() || 'UTC';
  const periodStart = fromZonedTime(`${startD}T00:00:00`, tz).toISOString();
  const periodEnd = fromZonedTime(`${endD}T23:59:59.999`, tz).toISOString();
  if (new Date(periodStart) >= new Date(periodEnd)) {
    return res.status(400).json({ error: 'invalid_period' });
  }

  const title =
    (body.title && body.title.trim()) ||
    `${reportType} · ${startD} — ${endD}`;

  const { data: inserted, error: insErr } = await supabase
    .from('reports')
    .insert({
      farm_id: body.farmId,
      cycle_id: body.cycleId,
      scope_id: body.scopeId ?? null,
      report_type: reportType,
      audience_type: audienceType,
      output_format: outputFormat,
      title,
      status: 'draft',
      period_start: periodStart,
      period_end: periodEnd,
      report_json: {
        pipeline_version: 'adr007-v1',
        request_pending: true,
      },
      created_by: user.id,
    })
    .select('id')
    .single();

  if (insErr || !inserted?.id) {
    return res.status(500).json({ error: 'insert_failed', detail: insErr?.message });
  }

  const reportId = inserted.id as string;

  try {
    const jobId = await enqueueBackgroundJob(supabase, {
      jobType: 'report.generate',
      farmId: body.farmId,
      cycleId: body.cycleId,
      scopeId: body.scopeId ?? null,
      entityType: 'report',
      entityId: reportId,
      dedupKey: `report.generate:${reportId}`,
      payloadJson: { report_id: reportId },
    });
    return res.status(200).json({ reportId, jobId, periodStart, periodEnd, timezone: tz });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabase.from('reports').update({ status: 'failed', summary_text: msg }).eq('id', reportId);
    return res.status(500).json({ error: 'enqueue_failed', detail: msg, reportId });
  }
}
