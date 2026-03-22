import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BackgroundJobRow } from '@/types/background-jobs';
import type {
  AudienceType,
  ReportBlock,
  ReportJsonV1,
  ReportType,
} from '@/types/report';
import type { TimeWindowIso } from '@/types/retrieval-assembly';
import {
  fetchAnomalyEvents,
  fetchCycle,
  fetchDailyTimelines,
  fetchPhotosWithAnalysis,
  fetchRecentEvents,
  fetchScopeHint,
  fetchSensorReadings,
  fetchSopContextRows,
} from '@/lib/growlog/retrieval/fetch-context';
import type { ScoredLine } from '@/types/retrieval-assembly';
import type { RecentEventItem } from '@/types/retrieval-assembly';
import type { PhotoContextItem } from '@/types/retrieval-assembly';
import type { AnomalyContextItem, SopContextItem } from '@/types/retrieval-assembly';

const PIPELINE_VERSION = 'adr007-v1' as const;
const TEXT_MODEL = 'gpt-4o-mini';

const UUID_RE =
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi;

export function sanitizePublicText(input: string): string {
  return input.replace(UUID_RE, '[…]').replace(/\bfarm_id\b/gi, 'проект');
}

function sanitizeBlocksForPublic(blocks: ReportBlock[]): ReportBlock[] {
  const walk = (b: ReportBlock): ReportBlock => {
    switch (b.kind) {
      case 'executive_summary':
      case 'narrative':
      case 'appendix':
        return { ...b, body: sanitizePublicText(b.body) };
      case 'timeline_highlights':
        return {
          ...b,
          items: b.items.map((i) => ({
            ...i,
            summary: sanitizePublicText(i.summary),
          })),
        };
      case 'anomalies':
        return {
          ...b,
          items: b.items.map((i) => ({
            ...i,
            summary: sanitizePublicText(i.summary),
          })),
        };
      case 'missing_data':
        return {
          ...b,
          notes: b.notes.map((n) => sanitizePublicText(n)),
        };
      default:
        return b;
    }
  };
  return blocks.map(walk);
}

function windowFromReport(periodStart: string | null, periodEnd: string | null): TimeWindowIso | null {
  if (!periodStart?.trim() || !periodEnd?.trim()) return null;
  return { from: periodStart, to: periodEnd };
}

function filterPhotosToWindow(
  photos: ScoredLine<PhotoContextItem>[],
  window: TimeWindowIso
): ScoredLine<PhotoContextItem>[] {
  const a = new Date(window.from).getTime();
  const b = new Date(window.to).getTime();
  return photos.filter((p) => {
    const t = p.capturedAt ? new Date(p.capturedAt).getTime() : a;
    return t >= a && t <= b;
  });
}

function pickCuratedPhotos(
  photos: ScoredLine<PhotoContextItem>[],
  max = 8
): { mediaAssetId: string; caption: string | null; layoutRole: string }[] {
  const sorted = [...photos].sort((x, y) => y.relevanceScore - x.relevanceScore);
  const out: { mediaAssetId: string; caption: string | null; layoutRole: string }[] = [];
  const seen = new Set<string>();
  for (const p of sorted) {
    if (out.length >= max) break;
    if (seen.has(p.mediaAssetId)) continue;
    seen.add(p.mediaAssetId);
    const caption = p.analysisSummary
      ? p.analysisSummary.slice(0, 220) + (p.analysisSummary.length > 220 ? '…' : '')
      : p.fileName;
    const role =
      out.length === 0 ? 'hero' : out.length % 3 === 1 ? 'evidence' : 'collage';
    out.push({ mediaAssetId: p.mediaAssetId, caption, layoutRole: role });
  }
  return out;
}

function buildMetricStrip(
  sensors: ScoredLine<{ metricName: string; valueNumeric: number; unit: string | null }>[]
): ReportBlock {
  const top = sensors.slice(0, 6).map((s) => ({
    label: s.metricName,
    value: `${s.valueNumeric}${s.unit ? ` ${s.unit}` : ''}`,
    source: 'observed_fact' as const,
  }));
  return {
    kind: 'metric_strip',
    title: 'Срез сенсоров (выборка)',
    items: top.length ? top : [{ label: 'Нет записей', value: '—', source: 'missing_data' }],
  };
}

function buildTimeline(events: ScoredLine<RecentEventItem>[], limit: number): ReportBlock {
  return {
    kind: 'timeline_highlights',
    title: 'Ключевые события',
    items: events.slice(0, limit).map((e) => ({
      at: e.occurredAt,
      eventType: e.eventType,
      summary: (e.title || e.body || 'событие').slice(0, 280),
    })),
  };
}

function buildAnomalies(rows: ScoredLine<AnomalyContextItem>[]): ReportBlock {
  return {
    kind: 'anomalies',
    title: 'Аномалии и предупреждения',
    items: rows.slice(0, 12).map((r) => ({
      at: r.occurredAt,
      summary: ((r.body || r.title) ?? 'запись').slice(0, 280),
      severity: r.severity,
    })),
  };
}

function buildSopBlock(items: SopContextItem[], limit: number): ReportBlock {
  return {
    kind: 'sop_compliance',
    title: 'SOP / задачи цикла',
    items: items.slice(0, limit).map((r) => ({
      title: r.definitionTitle,
      status: r.status,
      dueAt: r.dueAt,
    })),
  };
}

function missingDataNotes(params: {
  window: TimeWindowIso | null;
  cycleId: string | null;
  eventsEmpty: boolean;
  sensorsEmpty: boolean;
}): string[] {
  const notes: string[] = [];
  if (!params.window) {
    notes.push('Период отчёта не задан — события и сенсоры не фильтровались по окну.');
  }
  if (!params.cycleId) {
    notes.push('Цикл не привязан — SOP и часть контекста могут быть пустыми.');
  }
  if (params.eventsEmpty) {
    notes.push('За период не найдено событий в выбранном scope.');
  }
  if (params.sensorsEmpty) {
    notes.push('За период нет сенсорных записей в выбранном scope.');
  }
  return notes;
}

export function assembleReportBlocks(params: {
  reportType: ReportType;
  audience: AudienceType;
  title: string;
  window: TimeWindowIso | null;
  cycleId: string | null;
  cycleName: string | null;
  cycleStage: string | null;
  scopeLabel: string;
  recentEvents: ScoredLine<RecentEventItem>[];
  anomalies: ScoredLine<AnomalyContextItem>[];
  sensors: ScoredLine<{
    metricName: string;
    valueNumeric: number;
    unit: string | null;
  }>[];
  sopItems: SopContextItem[];
  dailyTimelines: { timelineDate: string; summaryText: string | null }[];
  curatedPhotos: { mediaAssetId: string; caption: string | null; layoutRole: string }[];
}): { blocks: ReportBlock[]; executiveSummary: string; missing: string[] } {
  const { reportType, audience, window, scopeLabel, cycleName, cycleStage } = params;

  const periodLabel = window
    ? `${window.from.slice(0, 10)} — ${window.to.slice(0, 10)}`
    : 'период не задан';

  const header: ReportBlock = {
    kind: 'header',
    title: params.title,
    periodLabel,
    scopeLabel,
    cycleName,
    cycleStage,
  };

  const missing = missingDataNotes({
    window,
    cycleId: params.cycleId,
    eventsEmpty: params.recentEvents.length === 0,
    sensorsEmpty: params.sensors.length === 0,
  });
  if (!window) {
    missing.unshift('Отчёт собран без валидного периода (period_start / period_end).');
  }

  const timelinesSummary =
    params.dailyTimelines.length > 0
      ? params.dailyTimelines
          .map((d) => `${d.timelineDate}: ${d.summaryText ?? '—'}`)
          .join('\n')
      : null;

  let execBody = '';
  if (reportType === 'manager' || audience === 'internal_management') {
    const overdue = params.sopItems.filter((s) => s.status === 'overdue').length;
    execBody = [
      `За период зафиксировано событий: ${params.recentEvents.length}.`,
      overdue ? `Просроченных SOP: ${overdue}.` : 'Просроченных SOP не найдено в выборке.',
      params.anomalies.length
        ? `Есть ${params.anomalies.length} отметок в блоке аномалий/рисков.`
        : 'Явных аномалий в выборке нет.',
    ].join(' ');
  } else if (reportType === 'daily') {
    execBody = [
      timelinesSummary
        ? `Дневные сводки:\n${timelinesSummary}`
        : `Событий за день: ${params.recentEvents.length}.`,
      `Сенсорных точек в окне: ${params.sensors.length}.`,
    ].join('\n');
  } else {
    execBody = [
      `Период: ${periodLabel}. Событий: ${params.recentEvents.length}.`,
      cycleName ? `Цикл: ${cycleName}${cycleStage ? `, стадия: ${cycleStage}` : ''}.` : '',
      timelinesSummary ? `Дневные сводки:\n${timelinesSummary}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }

  const blocks: ReportBlock[] = [
    header,
    {
      kind: 'executive_summary',
      title: 'Краткое резюме',
      body: execBody || 'Недостаточно данных для резюме.',
      trust: 'derived_metric',
    },
    buildMetricStrip(params.sensors),
    buildTimeline(
      params.recentEvents,
      reportType === 'manager' ? 8 : reportType === 'daily' ? 12 : 14
    ),
    buildAnomalies(params.anomalies),
    buildSopBlock(params.sopItems, reportType === 'manager' ? 16 : 12),
  ];

  if (params.curatedPhotos.length) {
    blocks.push({
      kind: 'photos',
      title: 'Подобранные фото',
      items: params.curatedPhotos,
    });
  }

  if (missing.length) {
    blocks.push({
      kind: 'missing_data',
      title: 'Пробелы и ограничения данных',
      notes: missing,
    });
  }

  blocks.push({
    kind: 'appendix',
    title: 'Мета',
    body: `Тип отчёта: ${reportType}. Аудитория: ${audience}. Сборка: ${PIPELINE_VERSION}.`,
    trust: 'observed_fact',
  });

  return { blocks, executiveSummary: execBody, missing };
}

async function maybeGenerateNarrative(params: {
  reportType: ReportType;
  audience: AudienceType;
  executiveSummary: string;
  window: TimeWindowIso | null;
}): Promise<{ body: string; trust: 'ai_generated' }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    return {
      body:
        params.audience === 'public_community'
          ? 'Черновик narrative отключён (нет OPENAI_API_KEY). Используйте фактические блоки выше.'
          : 'Narrative-слой не сгенерирован (нет OPENAI_API_KEY). Блоки выше — детерминированы из данных.',
      trust: 'ai_generated',
    };
  }
  const openai = new OpenAI({ apiKey: key });
  const sys = `Ты помогаешь собирать grow-отчёты. Пиши по-русски, кратко (2–4 абзаца).
Правила ADR-004/007: не выдумывай измерения и факты; опирайся только на переданный контекст; при нехватке данных прямо укажи это.
Стиль зависит от аудитории: для internal — операционно; для public_community — спокойный рассказ без внутренних идентификаторов.`;
  const user = JSON.stringify({
    report_type: params.reportType,
    audience: params.audience,
    time_window: params.window,
    executive_summary: params.executiveSummary,
  });
  const res = await openai.chat.completions.create({
    model: TEXT_MODEL,
    messages: [
      { role: 'system', content: sys },
      { role: 'user', content: user },
    ],
    temperature: 0.35,
    max_tokens: 700,
  });
  const text = res.choices[0]?.message?.content?.trim() || '';
  return { body: text || 'Пустой ответ модели.', trust: 'ai_generated' };
}

async function insertReportMediaSelections(
  supabase: SupabaseClient,
  farmId: string,
  reportId: string,
  photos: { mediaAssetId: string; caption: string | null; layoutRole: string }[]
) {
  if (!photos.length) return;
  const rows = photos.map((p, i) => ({
    farm_id: farmId,
    report_id: reportId,
    media_asset_id: p.mediaAssetId,
    selection_reason: p.caption,
    layout_role: ['hero', 'evidence', 'collage', 'appendix', 'hidden_gallery'].includes(
      p.layoutRole
    )
      ? p.layoutRole
      : 'evidence',
    sort_order: i,
  }));
  const { error } = await supabase.from('report_media_selections').insert(rows);
  if (error) throw error;
}

async function insertArtifacts(
  supabase: SupabaseClient,
  farmId: string,
  reportId: string,
  outputFormat: string
) {
  const base = {
    farm_id: farmId,
    report_id: reportId,
    version: PIPELINE_VERSION,
  };
  const { error: hErr } = await supabase.from('report_artifacts').insert({
    ...base,
    artifact_type: 'html',
    url: null,
  });
  if (hErr) throw hErr;

  if (outputFormat === 'pdf' || outputFormat === 'both') {
    const { error: pErr } = await supabase.from('report_artifacts').insert({
      ...base,
      artifact_type: 'pdf',
      url: null,
      version: 'not_generated_mvp',
    });
    if (pErr) throw pErr;
  }
}

export async function processReportGenerateJob(
  supabase: SupabaseClient,
  job: BackgroundJobRow
): Promise<Record<string, unknown>> {
  const reportId = (job.payload_json?.report_id as string) ?? job.entity_id;
  if (!reportId) {
    throw new Error('report.generate: report_id missing');
  }

  const { data: report, error: rErr } = await supabase
    .from('reports')
    .select('*')
    .eq('id', reportId)
    .eq('farm_id', job.farm_id)
    .single();
  if (rErr) throw rErr;
  if (!report) {
    throw new Error('report not found');
  }

  const window = windowFromReport(report.period_start, report.period_end);
  if (!window) {
    const { error: uErr } = await supabase
      .from('reports')
      .update({ status: 'failed', summary_text: 'Не задан период (period_start / period_end).' })
      .eq('id', reportId);
    if (uErr) throw uErr;
    throw new Error('report pipeline: period_start/period_end required');
  }

  const farmId = report.farm_id as string;
  const cycleId = report.cycle_id as string | null;
  const scopeId = report.scope_id as string | null;
  const reportType = report.report_type as ReportType;
  const audience = (report.audience_type as AudienceType) || 'internal_operational';
  const outputFormat = (report.output_format as string) || 'html';

  const [cycle, scopeHint, recentEvents, anomalies, sensors, photosRaw, sopRows, dailyTimelines] =
    await Promise.all([
      fetchCycle(supabase, farmId, cycleId),
      fetchScopeHint(supabase, farmId, scopeId),
      fetchRecentEvents(supabase, { farmId, cycleId, scopeId, window }),
      fetchAnomalyEvents(supabase, { farmId, cycleId, scopeId, window }),
      fetchSensorReadings(supabase, { farmId, cycleId, scopeId, window }),
      fetchPhotosWithAnalysis(supabase, {
        farmId,
        cycleId,
        scopeId,
        limit: 48,
        window,
      }),
      fetchSopContextRows(supabase, farmId, cycleId),
      fetchDailyTimelines(supabase, { farmId, cycleId, scopeId, window }),
    ]);

  const photos = filterPhotosToWindow(photosRaw, window);
  const curated = pickCuratedPhotos(photos);

  const scopeLabel = scopeHint?.display_name ?? (scopeId ? 'scope' : 'весь цикл');

  const { blocks: rawBlocks, executiveSummary } = assembleReportBlocks({
    reportType,
    audience,
    title: report.title as string,
    window,
    cycleId,
    cycleName: cycle?.name ?? null,
    cycleStage: cycle?.stage ?? null,
    scopeLabel,
    recentEvents,
    anomalies,
    sensors,
    sopItems: sopRows.map(
      (r) =>
        ({
          runId: r.runId,
          definitionTitle: r.definitionTitle,
          status: r.status,
          dueAt: r.dueAt,
          reasonText: r.reasonText,
          scopeId: r.scopeId,
        }) satisfies SopContextItem
    ),
    dailyTimelines,
    curatedPhotos: curated,
  });

  const narrative = await maybeGenerateNarrative({
    reportType,
    audience,
    executiveSummary,
    window,
  });

  const appendix = rawBlocks[rawBlocks.length - 1];
  const bodyBlocks = rawBlocks.slice(0, -1);
  let blocks: ReportBlock[] = [
    ...bodyBlocks,
    {
      kind: 'narrative',
      title: 'Narrative',
      body: narrative.body,
      trust: narrative.trust,
    },
    appendix,
  ];

  if (audience === 'public_community') {
    blocks = sanitizeBlocksForPublic(blocks);
  }

  const reportJson: ReportJsonV1 = {
    pipeline_version: PIPELINE_VERSION,
    request: {
      report_type: reportType,
      audience_type: audience,
      output_format: outputFormat as ReportJsonV1['request']['output_format'],
      time_window: { from: window.from, to: window.to },
      scope_label: scopeLabel,
    },
    blocks,
    trust_notes: [
      'Фактические блоки собраны из events / sensor_readings / daily_timelines / SOP / media.',
      'Narrative помечен как ai_generated и не должен подменять измерения.',
    ],
    pdf_status: outputFormat === 'pdf' || outputFormat === 'both' ? 'not_generated' : undefined,
  };

  const { error: upErr } = await supabase
    .from('reports')
    .update({
      status: 'ready',
      summary_text: executiveSummary.slice(0, 8000),
      narrative_text: narrative.body.slice(0, 8000),
      report_json: reportJson as unknown as Record<string, unknown>,
    })
    .eq('id', reportId);
  if (upErr) throw upErr;

  await supabase.from('report_media_selections').delete().eq('report_id', reportId);
  await insertReportMediaSelections(supabase, farmId, reportId, curated);

  await supabase.from('report_artifacts').delete().eq('report_id', reportId);
  await insertArtifacts(supabase, farmId, reportId, outputFormat);

  const { data: ev, error: evErr } = await supabase
    .from('events')
    .insert({
      farm_id: farmId,
      cycle_id: cycleId,
      scope_id: scopeId,
      event_type: 'report_generated',
      title: report.title as string,
      body: (executiveSummary || 'Отчёт собран').slice(0, 4000),
      occurred_at: new Date().toISOString(),
      source_type: 'system',
      severity: 'info',
      payload: {
        report_id: reportId,
        report_type: reportType,
        pipeline_version: PIPELINE_VERSION,
      },
    })
    .select('id')
    .single();
  if (evErr) throw evErr;

  const { error: eeErr } = await supabase.from('event_entities').insert({
    farm_id: farmId,
    event_id: ev!.id,
    entity_type: 'report',
    entity_id: reportId,
    role: 'primary',
  });
  if (eeErr) throw eeErr;

  return {
    handled: true,
    report_id: reportId,
    event_id: ev!.id,
    blocks: blocks.length,
  };
}
