import type { SupabaseClient } from '@supabase/supabase-js';
import type { GrowCycle } from '@/types/database';
import type {
  ActionLogItem,
  AiInsightRefItem,
  AnomalyContextItem,
  CausalLinkItem,
  DailyTimelineItem,
  HistoricalCycleItem,
  KnowledgeContextItem,
  MemoryContextItem,
  ObservationItem,
  PhotoContextItem,
  PhotoTimelineSignalItem,
  RecentEventItem,
  ScoredLine,
  SensorContextItem,
  SopContextItem,
  TimeWindowIso,
} from '@/types/retrieval-assembly';
import { DEFAULT_PHOTO_ANALYSIS_VERSION } from '@/lib/growlog/photo-constants';
import { fetchOpenSopRuns } from '@/lib/growlog/sop-queries';
import type { SopRunRow } from '@/types/sop';

const MAX_EVENTS = 45;
const MAX_SENSORS = 45;
const MAX_PHOTOS = 12;
const MAX_ANOMALIES = 18;
const MAX_OBS = 24;
const MAX_ACTIONS = 20;
const MAX_LINKS = 24;
const MAX_TIMELINES = 14;
const MAX_HIST = 5;
const MAX_PATTERN_INSIGHTS = 5;
const MAX_SEARCH_DOCS = 8;
const BODY_TRUNC = 420;

function trunc(s: string | null, n = BODY_TRUNC): string | null {
  if (!s) return null;
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n)}…`;
}

function timeRelevance(occurredAt: string, window: TimeWindowIso): number {
  const t = new Date(occurredAt).getTime();
  const a = new Date(window.from).getTime();
  const b = new Date(window.to).getTime();
  if (b <= a) return 0.75;
  const x = (t - a) / (b - a);
  return Math.min(1, Math.max(0.5, 0.5 + x * 0.5));
}

function score<T extends { id: string }>(
  rows: T[],
  getTime: (row: T) => string,
  window: TimeWindowIso
): ScoredLine<T>[] {
  return rows.map((row) => ({
    ...row,
    relevanceScore: timeRelevance(getTime(row), window),
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCycleScope(q: any, cycleId: string | null, scopeId: string | null) {
  let query = q;
  if (cycleId) {
    query = query.eq('cycle_id', cycleId);
  }
  if (scopeId) {
    query = query.or(`scope_id.eq.${scopeId},scope_id.is.null`);
  }
  return query;
}

/**
 * ADR-003 / ADR-010: при выбранном scope не подмешивать «без scope» медиа — приоритет scope match.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyCycleScopeForPhotos(q: any, cycleId: string | null, scopeId: string | null) {
  let query = q;
  if (cycleId) {
    query = query.eq('cycle_id', cycleId);
  }
  if (scopeId) {
    query = query.eq('scope_id', scopeId);
  }
  return query;
}

export async function fetchFarmTimezone(
  supabase: SupabaseClient,
  farmId: string
): Promise<string> {
  const { data, error } = await supabase
    .from('farms')
    .select('timezone')
    .eq('id', farmId)
    .single();
  if (error) throw error;
  return data?.timezone?.trim() || 'UTC';
}

export async function fetchCycle(
  supabase: SupabaseClient,
  farmId: string,
  cycleId: string | null
): Promise<GrowCycle | null> {
  if (!cycleId) return null;
  const { data, error } = await supabase
    .from('grow_cycles')
    .select('*')
    .eq('id', cycleId)
    .eq('farm_id', farmId)
    .maybeSingle();
  if (error) throw error;
  return data as GrowCycle | null;
}

export async function fetchScopeHint(
  supabase: SupabaseClient,
  farmId: string,
  scopeId: string | null
): Promise<{ id: string; display_name: string } | null> {
  if (!scopeId) return null;
  const { data } = await supabase
    .from('scopes')
    .select('id, display_name')
    .eq('id', scopeId)
    .eq('farm_id', farmId)
    .maybeSingle();
  return data ? { id: data.id, display_name: data.display_name } : null;
}

export async function fetchRecentEvents(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    scopeId: string | null;
    window: TimeWindowIso;
  }
): Promise<ScoredLine<RecentEventItem>[]> {
  let q = supabase
    .from('events')
    .select('id, occurred_at, event_type, title, body, scope_id, severity')
    .eq('farm_id', params.farmId)
    .gte('occurred_at', params.window.from)
    .lte('occurred_at', params.window.to)
    .order('occurred_at', { ascending: false })
    .limit(MAX_EVENTS);

  q = applyCycleScope(q, params.cycleId, params.scopeId);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    occurred_at: string;
    event_type: string;
    title: string | null;
    body: string | null;
    scope_id: string | null;
    severity: string | null;
  }[];

  const mapped: RecentEventItem[] = rows.map((e) => ({
    id: e.id,
    occurredAt: e.occurred_at,
    eventType: e.event_type,
    title: e.title,
    body: trunc(e.body),
    scopeId: e.scope_id,
    severity: e.severity,
  }));
  return score(mapped, (r) => r.occurredAt, params.window);
}

export async function fetchAnomalyEvents(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    scopeId: string | null;
    window: TimeWindowIso;
  }
): Promise<ScoredLine<AnomalyContextItem>[]> {
  let q = supabase
    .from('events')
    .select('id, occurred_at, event_type, title, body, severity')
    .eq('farm_id', params.farmId)
    .gte('occurred_at', params.window.from)
    .lte('occurred_at', params.window.to)
    .or('event_type.eq.anomaly,event_type.eq.issue_detected,severity.eq.warning,severity.eq.critical')
    .order('occurred_at', { ascending: false })
    .limit(MAX_ANOMALIES);

  q = applyCycleScope(q, params.cycleId, params.scopeId);

  const { data, error } = await q;
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    occurred_at: string;
    event_type: string;
    title: string | null;
    body: string | null;
    severity: string | null;
  }[];

  const mapped: AnomalyContextItem[] = rows.map((e) => ({
    id: e.id,
    occurredAt: e.occurred_at,
    eventType: e.event_type,
    title: e.title,
    body: trunc(e.body),
    severity: e.severity,
  }));
  return score(mapped, (r) => r.occurredAt, params.window);
}

export async function fetchSensorReadings(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    scopeId: string | null;
    window: TimeWindowIso;
  }
): Promise<ScoredLine<SensorContextItem>[]> {
  let q = supabase
    .from('sensor_readings')
    .select(
      `
        id,
        captured_at,
        value_numeric,
        unit,
        scope_id,
        sensor_metrics ( metric_code, name )
      `
    )
    .eq('farm_id', params.farmId)
    .gte('captured_at', params.window.from)
    .lte('captured_at', params.window.to)
    .order('captured_at', { ascending: false })
    .limit(MAX_SENSORS);

  q = applyCycleScope(q, params.cycleId, params.scopeId);

  const { data, error } = await q;
  if (error) throw error;
  const raw = (data ?? []) as {
    id: string;
    captured_at: string;
    value_numeric: number;
    unit: string | null;
    scope_id: string | null;
    sensor_metrics:
      | { metric_code: string; name: string }
      | { metric_code: string; name: string }[]
      | null;
  }[];

  const mapped: SensorContextItem[] = raw.map((r) => {
    const m = r.sensor_metrics;
    const metric = Array.isArray(m) ? m[0] : m;
    return {
      id: r.id,
      capturedAt: r.captured_at,
      metricCode: metric?.metric_code ?? 'unknown',
      metricName: metric?.name ?? 'metric',
      valueNumeric: Number(r.value_numeric),
      unit: r.unit,
      scopeId: r.scope_id,
    };
  });
  return score(mapped, (r) => r.capturedAt, params.window);
}

export async function fetchPhotosWithAnalysis(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    scopeId: string | null;
    limit: number;
    window: TimeWindowIso;
  }
): Promise<ScoredLine<PhotoContextItem>[]> {
  let q = supabase
    .from('media_assets')
    .select('id, captured_at, file_name, scope_id, cycle_id, analysis_status')
    .eq('farm_id', params.farmId)
    .eq('media_type', 'image')
    .order('created_at', { ascending: false })
    .limit(params.limit);

  q = applyCycleScopeForPhotos(q, params.cycleId, params.scopeId);

  const { data: media, error: mErr } = await q;
  if (mErr) throw mErr;
  const assets = (media ?? []) as {
    id: string;
    captured_at: string | null;
    file_name: string | null;
    analysis_status: string | null;
  }[];

  if (!assets.length) return [];

  const ids = assets.map((a) => a.id);
  const { data: analyses, error: aErr } = await supabase
    .from('photo_analysis')
    .select('media_asset_id, summary_text, tags, confidence')
    .eq('farm_id', params.farmId)
    .eq('analysis_version', DEFAULT_PHOTO_ANALYSIS_VERSION)
    .in('media_asset_id', ids);
  if (aErr) throw aErr;

  const byMedia = new Map<
    string,
    { summary_text: string | null; tags: string[]; confidence: number | null }
  >();
  for (const row of analyses ?? []) {
    const r = row as {
      media_asset_id: string;
      summary_text: string | null;
      tags: string[] | null;
      confidence: number | null;
    };
    byMedia.set(r.media_asset_id, {
      summary_text: r.summary_text,
      tags: Array.isArray(r.tags) ? r.tags : [],
      confidence: r.confidence != null ? Number(r.confidence) : null,
    });
  }

  const mapped: PhotoContextItem[] = assets.map((a) => {
    const pa = byMedia.get(a.id);
    return {
      id: a.id,
      mediaAssetId: a.id,
      capturedAt: a.captured_at,
      fileName: a.file_name,
      analysisSummary: pa?.summary_text ?? null,
      tags: pa?.tags ?? [],
      analysisStatus: a.analysis_status ?? null,
      analysisConfidence: pa?.confidence ?? null,
    };
  });

  return score(
    mapped,
    (p) => p.capturedAt ?? params.window.from,
    params.window
  );
}

const MAX_PHOTO_TIMELINE = 10;
const MAX_MEDIA_IDS_FOR_TIMELINE = 96;

async function collectMediaAssetIdsInRetrievalWindow(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    scopeId: string | null;
    window: TimeWindowIso;
    limit: number;
  }
): Promise<string[]> {
  let q1 = supabase
    .from('media_assets')
    .select('id')
    .eq('farm_id', params.farmId)
    .eq('media_type', 'image')
    .not('captured_at', 'is', null)
    .gte('captured_at', params.window.from)
    .lte('captured_at', params.window.to)
    .limit(params.limit);
  q1 = applyCycleScopeForPhotos(q1, params.cycleId, params.scopeId);

  let q2 = supabase
    .from('media_assets')
    .select('id')
    .eq('farm_id', params.farmId)
    .eq('media_type', 'image')
    .is('captured_at', null)
    .gte('created_at', params.window.from)
    .lte('created_at', params.window.to)
    .limit(params.limit);
  q2 = applyCycleScopeForPhotos(q2, params.cycleId, params.scopeId);

  const [r1, r2] = await Promise.all([q1, q2]);
  if (r1.error) throw r1.error;
  if (r2.error) throw r2.error;
  const set = new Set<string>();
  for (const row of [...(r1.data ?? []), ...(r2.data ?? [])]) {
    set.add((row as { id: string }).id);
  }
  return [...set].slice(0, params.limit);
}

export async function fetchPhotoTimelineSignals(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    scopeId: string | null;
    window: TimeWindowIso;
  }
): Promise<PhotoTimelineSignalItem[]> {
  const ids = await collectMediaAssetIdsInRetrievalWindow(supabase, {
    farmId: params.farmId,
    cycleId: params.cycleId,
    scopeId: params.scopeId,
    window: params.window,
    limit: MAX_MEDIA_IDS_FOR_TIMELINE,
  });
  if (!ids.length) return [];

  const sel =
    'id, from_media_asset_id, to_media_asset_id, scope_id, signal_type, signal_strength, description, created_at';

  let qTo = supabase
    .from('photo_timeline_signals')
    .select(sel)
    .eq('farm_id', params.farmId)
    .in('to_media_asset_id', ids);
  qTo = applyCycleScopeForPhotos(qTo, params.cycleId, params.scopeId);

  let qFrom = supabase
    .from('photo_timeline_signals')
    .select(sel)
    .eq('farm_id', params.farmId)
    .in('from_media_asset_id', ids);
  qFrom = applyCycleScopeForPhotos(qFrom, params.cycleId, params.scopeId);

  const [{ data: toRows, error: e1 }, { data: fromRows, error: e2 }] = await Promise.all([
    qTo,
    qFrom,
  ]);
  if (e1) throw e1;
  if (e2) throw e2;

  type TimelineRow = {
    id: string;
    from_media_asset_id: string;
    to_media_asset_id: string;
    scope_id: string | null;
    signal_type: string;
    signal_strength: number | null;
    description: string | null;
    created_at: string;
  };
  const byId = new Map<string, TimelineRow>();
  for (const row of [...(toRows ?? []), ...(fromRows ?? [])]) {
    const r = row as TimelineRow;
    byId.set(r.id, r);
  }

  const sorted = [...byId.values()].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
  const rows = sorted.slice(0, MAX_PHOTO_TIMELINE);

  return rows.map((r) => ({
    id: r.id,
    fromMediaAssetId: r.from_media_asset_id,
    toMediaAssetId: r.to_media_asset_id,
    scopeId: r.scope_id,
    signalType: r.signal_type,
    signalStrength: r.signal_strength != null ? Number(r.signal_strength) : null,
    description: r.description,
  }));
}

function mapSopRuns(runs: SopRunRow[]): ScoredLine<SopContextItem>[] {
  return runs.map((r) => {
    const def = r.sop_definitions;
    const title =
      def && typeof def === 'object' && 'title' in def && typeof def.title === 'string'
        ? def.title
        : 'SOP';
    return {
      runId: r.id,
      definitionTitle: title,
      status: r.status,
      dueAt: r.due_at,
      reasonText: r.reason_text,
      scopeId: r.scope_id,
      relevanceScore: r.status === 'overdue' ? 1 : r.status === 'open' ? 0.85 : 0.7,
    };
  });
}

export async function fetchSopContextRows(
  supabase: SupabaseClient,
  farmId: string,
  cycleId: string | null
): Promise<ScoredLine<SopContextItem>[]> {
  if (!cycleId) return [];
  const runs = await fetchOpenSopRuns(supabase, { farmId, cycleId });
  return mapSopRuns(runs);
}

export async function fetchObservationsForEventIds(
  supabase: SupabaseClient,
  farmId: string,
  eventIds: string[],
  window: TimeWindowIso
): Promise<ScoredLine<ObservationItem>[]> {
  if (!eventIds.length) return [];
  const { data, error } = await supabase
    .from('observations')
    .select('id, event_id, observation_type, label, value_text, created_at')
    .eq('farm_id', farmId)
    .in('event_id', eventIds)
    .order('created_at', { ascending: false })
    .limit(MAX_OBS);
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    event_id: string;
    observation_type: string;
    label: string | null;
    value_text: string | null;
    created_at: string;
  }[];
  const mapped: ObservationItem[] = rows.map((o) => ({
    id: o.id,
    eventId: o.event_id,
    observationType: o.observation_type,
    label: o.label,
    valueText: o.value_text,
  }));
  return score(mapped, () => window.to, window);
}

export async function fetchActionsForEventIds(
  supabase: SupabaseClient,
  farmId: string,
  eventIds: string[],
  window: TimeWindowIso
): Promise<ScoredLine<ActionLogItem>[]> {
  if (!eventIds.length) return [];
  const { data, error } = await supabase
    .from('actions_log')
    .select('id, event_id, action_type, result_text, completed_at, created_at')
    .eq('farm_id', farmId)
    .in('event_id', eventIds)
    .order('created_at', { ascending: false })
    .limit(MAX_ACTIONS);
  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    event_id: string;
    action_type: string;
    result_text: string | null;
    completed_at: string | null;
    created_at: string;
  }[];
  const mapped: ActionLogItem[] = rows.map((a) => ({
    id: a.id,
    eventId: a.event_id,
    actionType: a.action_type,
    resultText: a.result_text,
    completedAt: a.completed_at,
    createdAt: a.created_at,
  }));
  return score(mapped, (a) => a.completedAt ?? a.createdAt, window);
}

export async function fetchCausalLinks(
  supabase: SupabaseClient,
  farmId: string,
  eventIds: string[]
): Promise<CausalLinkItem[]> {
  if (!eventIds.length) return [];

  const [fromRes, toRes] = await Promise.all([
    supabase
      .from('event_links')
      .select('id, from_event_id, to_event_id, relation_type')
      .eq('farm_id', farmId)
      .in('from_event_id', eventIds)
      .limit(MAX_LINKS),
    supabase
      .from('event_links')
      .select('id, from_event_id, to_event_id, relation_type')
      .eq('farm_id', farmId)
      .in('to_event_id', eventIds)
      .limit(MAX_LINKS),
  ]);

  if (fromRes.error) throw fromRes.error;
  if (toRes.error) throw toRes.error;

  const mapRow = (row: {
    id: string;
    from_event_id: string;
    to_event_id: string;
    relation_type: string;
  }): CausalLinkItem => ({
    id: row.id,
    fromEventId: row.from_event_id,
    toEventId: row.to_event_id,
    relationType: row.relation_type,
  });

  const byId = new Map<string, CausalLinkItem>();
  for (const row of fromRes.data ?? []) {
    const r = row as {
      id: string;
      from_event_id: string;
      to_event_id: string;
      relation_type: string;
    };
    byId.set(r.id, mapRow(r));
  }
  for (const row of toRes.data ?? []) {
    const r = row as {
      id: string;
      from_event_id: string;
      to_event_id: string;
      relation_type: string;
    };
    byId.set(r.id, mapRow(r));
  }
  return [...byId.values()].slice(0, MAX_LINKS);
}

export async function fetchDailyTimelines(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    scopeId: string | null;
    window: TimeWindowIso;
  }
): Promise<DailyTimelineItem[]> {
  const fromD = params.window.from.slice(0, 10);
  const toD = params.window.to.slice(0, 10);

  let q = supabase
    .from('daily_timelines')
    .select('id, timeline_date, summary_text, event_count, anomaly_count')
    .eq('farm_id', params.farmId)
    .gte('timeline_date', fromD)
    .lte('timeline_date', toD)
    .order('timeline_date', { ascending: false })
    .limit(MAX_TIMELINES);

  q = applyCycleScope(q, params.cycleId, params.scopeId);

  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as {
      id: string;
      timeline_date: string;
      summary_text: string | null;
      event_count: number;
      anomaly_count: number;
    };
    return {
      id: row.id,
      timelineDate: row.timeline_date,
      summaryText: row.summary_text,
      eventCount: row.event_count,
      anomalyCount: row.anomaly_count,
    };
  });
}

export async function fetchHistoricalCycles(
  supabase: SupabaseClient,
  farmId: string,
  currentCycleId: string | null
): Promise<HistoricalCycleItem[]> {
  const { data, error } = await supabase
    .from('grow_cycles')
    .select('id, name, stage, start_date, end_date, status')
    .eq('farm_id', farmId)
    .order('start_date', { ascending: false })
    .limit(MAX_HIST + 1);

  if (error) throw error;
  const rows = (data ?? []) as {
    id: string;
    name: string;
    stage: string;
    start_date: string;
    end_date: string | null;
    status: string;
  }[];
  return rows
    .filter((c) => !currentCycleId || c.id !== currentCycleId)
    .slice(0, MAX_HIST)
    .map(
      (c): HistoricalCycleItem => ({
        id: c.id,
        name: c.name,
        stage: c.stage,
        startDate: c.start_date,
        endDate: c.end_date,
        status: c.status,
      })
    );
}

export async function fetchPatternInsights(
  supabase: SupabaseClient,
  farmId: string
): Promise<AiInsightRefItem[]> {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('id, insight_type, title, body, created_at')
    .eq('farm_id', farmId)
    .eq('insight_type', 'pattern')
    .order('created_at', { ascending: false })
    .limit(MAX_PATTERN_INSIGHTS);
  if (error) throw error;
  return (data ?? []).map((r) => {
    const row = r as {
      id: string;
      insight_type: string;
      title: string | null;
      body: string;
      created_at: string;
    };
    return {
      id: row.id,
      insightType: row.insight_type,
      title: row.title,
      bodyExcerpt: trunc(row.body, 280) ?? '',
      createdAt: row.created_at,
    };
  });
}

export function pickSearchKeyword(queryText: string): string | null {
  const words = queryText
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);
  if (!words.length) return null;
  words.sort((a, b) => b.length - a.length);
  return words[0];
}

export async function fetchSearchableDocuments(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    keyword: string | null;
    wantKnowledge: boolean;
    wantMemory: boolean;
  }
): Promise<{
  knowledge: ScoredLine<KnowledgeContextItem>[];
  memory: ScoredLine<MemoryContextItem>[];
}> {
  const empty = {
    knowledge: [] as ScoredLine<KnowledgeContextItem>[],
    memory: [] as ScoredLine<MemoryContextItem>[],
  };
  if (!params.keyword) return empty;

  const safe = params.keyword.replace(/[%*,()]/g, '').slice(0, 64);
  if (safe.length < 3) return empty;

  const pattern = `%${safe}%`;

  const docTypes: string[] = [];
  if (params.wantKnowledge) {
    docTypes.push('knowledge_item', 'sop_definition');
  }
  if (params.wantMemory) {
    docTypes.push('grow_memory_item');
  }
  if (!docTypes.length) return empty;

  let q = supabase
    .from('searchable_documents')
    .select('id, doc_type, title, body, cycle_id')
    .eq('farm_id', params.farmId)
    .in('doc_type', docTypes)
    .or(`title.ilike.${pattern},body.ilike.${pattern}`)
    .limit(MAX_SEARCH_DOCS);

  if (params.cycleId) {
    q = q.or(`cycle_id.eq.${params.cycleId},cycle_id.is.null`);
  }

  const { data, error } = await q;
  if (error) throw error;

  const window: TimeWindowIso = {
    from: new Date(Date.now() - 365 * 24 * 3600 * 1000).toISOString(),
    to: new Date().toISOString(),
  };

  const knowledge: KnowledgeContextItem[] = [];
  const memory: MemoryContextItem[] = [];

  for (const row of data ?? []) {
    const r = row as {
      id: string;
      doc_type: string;
      title: string | null;
      body: string;
    };
    const excerpt = trunc(r.body, 360) ?? '';
    if (
      params.wantKnowledge &&
      (r.doc_type === 'knowledge_item' || r.doc_type === 'sop_definition')
    ) {
      knowledge.push({
        id: r.id,
        docType: r.doc_type,
        title: r.title,
        excerpt,
      });
    }
    if (params.wantMemory && r.doc_type === 'grow_memory_item') {
      memory.push({
        id: r.id,
        docType: r.doc_type,
        title: r.title,
        excerpt,
      });
    }
  }

  return {
    knowledge: score(knowledge, () => window.to, window),
    memory: score(memory, () => window.to, window),
  };
}
