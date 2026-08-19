import OpenAI from 'openai';
import { fromZonedTime } from 'date-fns-tz';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BackgroundJobRow } from '@/types/background-jobs';
import { assembleAnswerContext } from '@/lib/growlog/retrieval/assemble-answer-context';
import { formatRetrievalContextForPrompt } from '@/lib/growlog/assemble-retrieval-context';
import { parseAssistantModelJson } from '@/lib/assistant/response-schema';
import { ASSISTANT_SYSTEM } from '@/lib/assistant/prompts';

const TEXT_MODEL = 'gpt-4o-mini';
const ANOMALY_TYPES = new Set([
  'issue_detected',
  'pest_detected',
  'deficiency_suspected',
  'anomaly',
]);

function getOpenAI(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function payloadStr(job: BackgroundJobRow, key: string): string | null {
  const v = job.payload_json?.[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

async function farmLocalDate(
  supabase: SupabaseClient,
  farmId: string,
  at: Date
): Promise<string> {
  const { data } = await supabase.from('farms').select('timezone').eq('id', farmId).maybeSingle();
  const tz = (data as { timezone?: string } | null)?.timezone ?? 'UTC';
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

async function farmTimezone(supabase: SupabaseClient, farmId: string): Promise<string> {
  const { data } = await supabase.from('farms').select('timezone').eq('id', farmId).maybeSingle();
  return (data as { timezone?: string } | null)?.timezone ?? 'UTC';
}

/** UTC bounds for a farm-local calendar day (matches SQL farm_local_date). */
function localDateUtcBounds(timelineDate: string, timezone: string): { from: string; to: string } {
  const from = fromZonedTime(`${timelineDate}T00:00:00`, timezone);
  const to = fromZonedTime(`${timelineDate}T23:59:59.999`, timezone);
  return { from: from.toISOString(), to: to.toISOString() };
}

async function upsertSearchableDocument(
  supabase: SupabaseClient,
  row: {
    farm_id: string;
    doc_type: string;
    source_id: string;
    cycle_id?: string | null;
    scope_id?: string | null;
    title?: string | null;
    body: string;
    metadata?: Record<string, unknown>;
  }
) {
  const { data: existing } = await supabase
    .from('searchable_documents')
    .select('id')
    .eq('farm_id', row.farm_id)
    .eq('doc_type', row.doc_type)
    .eq('source_id', row.source_id)
    .maybeSingle();

  const payload = {
    farm_id: row.farm_id,
    doc_type: row.doc_type,
    source_id: row.source_id,
    cycle_id: row.cycle_id ?? null,
    scope_id: row.scope_id ?? null,
    title: row.title ?? null,
    body: row.body.slice(0, 12000),
    metadata: row.metadata ?? {},
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase.from('searchable_documents').update(payload).eq('id', existing.id);
    if (error) throw error;
    return existing.id as string;
  }

  const { data, error } = await supabase.from('searchable_documents').insert(payload).select('id').single();
  if (error) throw error;
  return data!.id as string;
}

export async function processDocumentIndexJob(
  supabase: SupabaseClient,
  job: BackgroundJobRow
): Promise<Record<string, unknown>> {
  const docType = payloadStr(job, 'doc_type') ?? 'event';
  const sourceId = payloadStr(job, 'source_id') ?? job.entity_id;
  if (!sourceId) throw new Error('document.index: source_id missing');

  if (docType === 'event') {
    const { data: ev, error } = await supabase
      .from('events')
      .select('id, farm_id, cycle_id, scope_id, event_type, title, body, occurred_at, source_type, payload')
      .eq('id', sourceId)
      .eq('farm_id', job.farm_id)
      .maybeSingle();
    if (error) throw error;
    if (!ev) return { indexed: false, reason: 'event_not_found' };

    const voice = (ev.payload as Record<string, unknown> | null)?.voice;
    const transcript =
      voice && typeof voice === 'object' && typeof (voice as { transcript?: string }).transcript === 'string'
        ? (voice as { transcript: string }).transcript
        : '';

    const body = [ev.title, ev.body, transcript ? `Голос: ${transcript}` : '']
      .filter(Boolean)
      .join('\n')
      .trim();

    const docId = await upsertSearchableDocument(supabase, {
      farm_id: ev.farm_id,
      doc_type: 'event',
      source_id: ev.id,
      cycle_id: ev.cycle_id,
      scope_id: ev.scope_id,
      title: ev.title ?? ev.event_type,
      body: body || ev.event_type,
      metadata: { event_type: ev.event_type, occurred_at: ev.occurred_at, source_type: ev.source_type },
    });

    await maybeExtractGrowMemory(supabase, {
      farmId: ev.farm_id,
      cycleId: ev.cycle_id,
      scopeId: ev.scope_id,
      eventId: ev.id,
      eventType: ev.event_type,
      title: ev.title,
      body: ev.body,
    });

    return { indexed: true, doc_type: 'event', searchable_document_id: docId };
  }

  if (docType === 'photo_analysis') {
    const { data: pa, error } = await supabase
      .from('photo_analysis')
      .select('id, farm_id, cycle_id, scope_id, summary_text, tags, media_asset_id')
      .eq('id', sourceId)
      .eq('farm_id', job.farm_id)
      .maybeSingle();
    if (error) throw error;
    if (!pa) return { indexed: false, reason: 'photo_analysis_not_found' };

    const docId = await upsertSearchableDocument(supabase, {
      farm_id: pa.farm_id,
      doc_type: 'photo_analysis',
      source_id: pa.id,
      cycle_id: pa.cycle_id,
      scope_id: pa.scope_id,
      title: 'Photo analysis',
      body: pa.summary_text ?? '',
      metadata: { tags: pa.tags, media_asset_id: pa.media_asset_id },
    });
    return { indexed: true, doc_type: 'photo_analysis', searchable_document_id: docId };
  }

  return { indexed: false, reason: 'unsupported_doc_type', doc_type: docType };
}

async function maybeExtractGrowMemory(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    scopeId: string | null;
    eventId: string;
    eventType: string;
    title: string | null;
    body: string | null;
  }
) {
  if (!ANOMALY_TYPES.has(params.eventType)) return;

  const memoryTitle = params.title ?? `Повторяющееся: ${params.eventType}`;
  const memoryBody = (params.body ?? params.eventType).slice(0, 2000);

  const { data: existing } = await supabase
    .from('grow_memory_items')
    .select('id')
    .eq('farm_id', params.farmId)
    .eq('memory_type', 'anomaly_recurrence')
    .contains('source_event_ids', [params.eventId])
    .maybeSingle();
  if (existing?.id) return;

  const { count } = await supabase
    .from('events')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', params.farmId)
    .eq('event_type', params.eventType)
    .gte('occurred_at', new Date(Date.now() - 30 * 86400000).toISOString());

  if ((count ?? 0) < 2) return;

  const { data: mem, error: memErr } = await supabase
    .from('grow_memory_items')
    .insert({
      farm_id: params.farmId,
      cycle_id: params.cycleId,
      scope_id: params.scopeId,
      memory_type: 'anomaly_recurrence',
      title: memoryTitle,
      body: `${memoryBody}. За 30 дней зафиксировано ${count} событий типа ${params.eventType}.`,
      confidence: 0.55,
      source_event_ids: [params.eventId],
    })
    .select('id')
    .single();
  if (memErr) return;

  await upsertSearchableDocument(supabase, {
    farm_id: params.farmId,
    doc_type: 'grow_memory_item',
    source_id: mem!.id as string,
    cycle_id: params.cycleId,
    scope_id: params.scopeId,
    title: memoryTitle,
    body: memoryBody,
    metadata: { memory_type: 'anomaly_recurrence', event_count_30d: count },
  });
}

export async function processTimelineDailyRefreshJob(
  supabase: SupabaseClient,
  job: BackgroundJobRow
): Promise<Record<string, unknown>> {
  const timelineDate =
    payloadStr(job, 'timeline_date') ??
    (job.scope_id ? await farmLocalDate(supabase, job.farm_id, new Date()) : null);
  if (!timelineDate) throw new Error('timeline.daily.refresh: timeline_date missing');

  const scopeId = job.scope_id;
  if (!scopeId) return { refreshed: false, reason: 'scope_id_required' };

  const tz = await farmTimezone(supabase, job.farm_id);
  const { from: dayStart, to: dayEnd } = localDateUtcBounds(timelineDate, tz);

  let eventsQ = supabase
    .from('events')
    .select('id, event_type, title, body, occurred_at, severity')
    .eq('farm_id', job.farm_id)
    .eq('scope_id', scopeId)
    .gte('occurred_at', dayStart)
    .lte('occurred_at', dayEnd)
    .order('occurred_at', { ascending: true });
  if (job.cycle_id) eventsQ = eventsQ.eq('cycle_id', job.cycle_id);

  const { data: events, error: evErr } = await eventsQ;
  if (evErr) throw evErr;
  const eventRows = events ?? [];

  const anomalyCount = eventRows.filter((e) =>
    ANOMALY_TYPES.has((e as { event_type: string }).event_type)
  ).length;

  let photosQ = supabase
    .from('media_assets')
    .select('id', { count: 'exact', head: true })
    .eq('farm_id', job.farm_id)
    .eq('scope_id', scopeId)
    .gte('captured_at', dayStart)
    .lte('captured_at', dayEnd);
  if (job.cycle_id) photosQ = photosQ.eq('cycle_id', job.cycle_id);
  const { count: photoCount } = await photosQ;

  const highlights = eventRows
    .slice(-8)
    .map((e) => {
      const r = e as { event_type: string; title: string | null; body: string | null };
      return `${r.event_type}${r.title ? `: ${r.title}` : ''}${r.body ? ` — ${r.body.slice(0, 80)}` : ''}`;
    })
    .join('; ');

  const summaryText =
    eventRows.length === 0
      ? 'За день записей нет.'
      : `${eventRows.length} событий${anomalyCount ? `, ${anomalyCount} отклонений` : ''}. ${highlights}`;

  const row = {
    farm_id: job.farm_id,
    cycle_id: job.cycle_id,
    scope_id: scopeId,
    timeline_date: timelineDate,
    summary_text: summaryText.slice(0, 4000),
    summary_json: {
      event_types: [...new Set(eventRows.map((e) => (e as { event_type: string }).event_type))],
      last_event_at: eventRows.length
        ? (eventRows[eventRows.length - 1] as { occurred_at: string }).occurred_at
        : null,
    },
    event_count: eventRows.length,
    photo_count: photoCount ?? 0,
    issue_count: anomalyCount,
    anomaly_count: anomalyCount,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { data: existing } = await supabase
    .from('daily_timelines')
    .select('id')
    .eq('farm_id', job.farm_id)
    .eq('scope_id', scopeId)
    .eq('timeline_date', timelineDate)
    .maybeSingle();

  if (existing?.id) {
    const { error } = await supabase.from('daily_timelines').update(row).eq('id', existing.id);
    if (error) throw error;
    return { refreshed: true, daily_timeline_id: existing.id, event_count: eventRows.length };
  }

  const { data: inserted, error: insErr } = await supabase
    .from('daily_timelines')
    .insert(row)
    .select('id')
    .single();
  if (insErr) throw insErr;
  return { refreshed: true, daily_timeline_id: inserted!.id, event_count: eventRows.length };
}

export async function processFocusRefreshJob(
  supabase: SupabaseClient,
  job: BackgroundJobRow
): Promise<Record<string, unknown>> {
  const focusDate =
    payloadStr(job, 'focus_date') ?? (await farmLocalDate(supabase, job.farm_id, new Date()));
  if (!job.scope_id) return { refreshed: false, reason: 'scope_id_required' };

  const dayStart = new Date(`${focusDate}T00:00:00.000Z`);
  const dayEnd = new Date(`${focusDate}T23:59:59.999Z`);

  const pack = await assembleAnswerContext(supabase, {
    farmId: job.farm_id,
    userId: '00000000-0000-0000-0000-000000000000',
    queryText: 'фокус дня daily focus что важно сегодня',
    cycleId: job.cycle_id,
    scopeId: job.scope_id,
    requestedTimeWindow: { from: dayStart.toISOString(), to: dayEnd.toISOString() },
  });

  const openai = getOpenAI();
  let title = `Фокус на ${focusDate}`;
  let body =
    pack.dailyTimelines[0]?.summaryText ??
    'Нет записей за сегодня — добавьте голосовую заметку или показания датчиков.';
  let facts: string[] = pack.recentEvents
    .slice(0, 5)
    .map((e) => `${e.eventType}: ${e.title ?? e.body ?? '—'}`);
  let insightType = 'daily_focus';

  if (
    openai &&
    (pack.recentEvents.length > 0 || pack.sensorContext.length > 0 || pack.anomalyContext.length > 0)
  ) {
    const contextBlock = formatRetrievalContextForPrompt(pack);
    try {
      const completion = await openai.chat.completions.create({
        model: TEXT_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ASSISTANT_SYSTEM },
          {
            role: 'user',
            content: `Сформируй JSON daily focus на ${focusDate}.\nКонтекст:\n${contextBlock}\n\nПоля: insight_type="daily_focus", title, body (кратко), facts (array), recommendation (string|null).`,
          },
        ],
      });
      const raw = completion.choices[0]?.message?.content ?? '';
      if (raw) {
        const parsed = parseAssistantModelJson(raw);
        title = parsed.title ?? title;
        body = parsed.body ?? body;
        facts = parsed.facts ?? facts;
        insightType = parsed.insight_type ?? insightType;
      }
    } catch {
      /* deterministic fallback */
    }
  }

  const { data: existing } = await supabase
    .from('ai_insights')
    .select('id')
    .eq('farm_id', job.farm_id)
    .eq('scope_id', job.scope_id)
    .eq('insight_type', 'daily_focus')
    .gte('created_at', dayStart.toISOString())
    .lte('created_at', dayEnd.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const insightRow = {
    farm_id: job.farm_id,
    cycle_id: job.cycle_id,
    scope_id: job.scope_id,
    insight_type: insightType,
    title,
    body: body.slice(0, 8000),
    facts_json: facts,
    confidence: 0.7,
    confidence_label: 'medium',
    model_name: openai ? TEXT_MODEL : 'deterministic_daily_timeline',
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase.from('ai_insights').update(insightRow).eq('id', existing.id);
    if (error) throw error;
    return { refreshed: true, ai_insight_id: existing.id, focus_date: focusDate };
  }

  const { data: ins, error: insErr } = await supabase
    .from('ai_insights')
    .insert({ ...insightRow, created_at: new Date().toISOString() })
    .select('id')
    .single();
  if (insErr) throw insErr;
  return { refreshed: true, ai_insight_id: ins!.id, focus_date: focusDate };
}

export async function processSnapshotRefreshJob(
  supabase: SupabaseClient,
  job: BackgroundJobRow
): Promise<Record<string, unknown>> {
  const readingId = payloadStr(job, 'sensor_reading_id') ?? job.entity_id;
  if (!readingId) throw new Error('snapshot.refresh: sensor_reading_id missing');

  const { data: reading, error } = await supabase
    .from('sensor_readings')
    .select('id, farm_id, cycle_id, scope_id, metric_id, value_numeric, captured_at, device_id')
    .eq('id', readingId)
    .eq('farm_id', job.farm_id)
    .maybeSingle();
  if (error) throw error;
  if (!reading) return { refreshed: false, reason: 'reading_not_found' };

  if (reading.device_id) {
    await supabase
      .from('sensor_devices')
      .update({ last_seen_at: reading.captured_at, updated_at: new Date().toISOString() })
      .eq('id', reading.device_id);
  }

  const statDate = await farmLocalDate(supabase, job.farm_id, new Date(reading.captured_at));
  const tz = await farmTimezone(supabase, job.farm_id);
  const { from: dayStart, to: dayEnd } = localDateUtcBounds(statDate, tz);

  let aggQ = supabase
    .from('sensor_readings')
    .select('value_numeric, captured_at')
    .eq('farm_id', reading.farm_id)
    .eq('metric_id', reading.metric_id)
    .gte('captured_at', dayStart)
    .lte('captured_at', dayEnd);
  if (reading.scope_id) aggQ = aggQ.eq('scope_id', reading.scope_id);

  const { data: dayReadings, error: aggErr } = await aggQ;
  if (aggErr) throw aggErr;

  const values = (dayReadings ?? []).map((r) => Number((r as { value_numeric: number }).value_numeric));
  if (!values.length) return { refreshed: false, reason: 'no_readings_for_day' };

  const min = Math.min(...values);
  const max = Math.max(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const lastAt = (dayReadings ?? []).reduce((best, r) => {
    const t = (r as { captured_at: string }).captured_at;
    return !best || t > best ? t : best;
  }, '' as string);

  const statRow = {
    farm_id: reading.farm_id,
    cycle_id: reading.cycle_id,
    scope_id: reading.scope_id,
    metric_id: reading.metric_id,
    stat_date: statDate,
    min_value: min,
    max_value: max,
    avg_value: Math.round(avg * 100) / 100,
    reading_count: values.length,
    last_captured_at: lastAt || reading.captured_at,
    updated_at: new Date().toISOString(),
  };

  const scopeFilter = reading.scope_id ?? null;
  let existingQ = supabase
    .from('environmental_daily_stats')
    .select('id')
    .eq('farm_id', reading.farm_id)
    .eq('metric_id', reading.metric_id)
    .eq('stat_date', statDate);
  existingQ = scopeFilter ? existingQ.eq('scope_id', scopeFilter) : existingQ.is('scope_id', null);
  const { data: existing } = await existingQ.maybeSingle();

  if (existing?.id) {
    const { error: upErr } = await supabase
      .from('environmental_daily_stats')
      .update(statRow)
      .eq('id', existing.id);
    if (upErr) throw upErr;
  } else {
    const { error: insErr } = await supabase.from('environmental_daily_stats').insert(statRow);
    if (insErr) throw insErr;
  }

  return {
    refreshed: true,
    stat_date: statDate,
    metric_id: reading.metric_id,
    reading_count: values.length,
    min,
    max,
    avg: statRow.avg_value,
  };
}
