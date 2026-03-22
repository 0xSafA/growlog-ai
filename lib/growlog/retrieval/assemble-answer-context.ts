import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnswerAssemblyContext } from '@/types/retrieval-assembly';
import { classifyQueryIntent } from '@/lib/growlog/retrieval/classify-intent';
import {
  applyRequestedTimeWindow,
  parseRequestedTimeWindow,
  resolveQueryScope,
} from '@/lib/growlog/retrieval/resolve-scope';
import { buildGuardrailsAndMissingData } from '@/lib/growlog/retrieval/guardrails';
import {
  fetchActionsForEventIds,
  fetchAnomalyEvents,
  fetchCausalLinks,
  fetchCycle,
  fetchDailyTimelines,
  fetchFarmTimezone,
  fetchHistoricalCycles,
  fetchObservationsForEventIds,
  fetchPatternInsights,
  fetchPhotosWithAnalysis,
  fetchPhotoTimelineSignals,
  fetchRecentEvents,
  fetchScopeHint,
  fetchSearchableDocuments,
  fetchSensorReadings,
  fetchSopContextRows,
  pickSearchKeyword,
} from '@/lib/growlog/retrieval/fetch-context';

/**
 * ADR-003 orchestration: resolve scope → classify intent → SQL retrieval layers → guardrails.
 */
export async function assembleAnswerContext(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    userId: string;
    queryText: string;
    cycleId: string | null;
    scopeId: string | null;
    /** ADR-003: явный период с клиента `{ from, to }` ISO; при успехе подменяет окно intent. */
    requestedTimeWindow?: unknown;
    conversationId?: string | null;
  }
): Promise<AnswerAssemblyContext> {
  const intentMeta = classifyQueryIntent(params.queryText);
  let resolved = resolveQueryScope({
    farmId: params.farmId,
    cycleId: params.cycleId,
    scopeId: params.scopeId,
    intentType: intentMeta.intentType,
  });

  const parsedTw = parseRequestedTimeWindow(params.requestedTimeWindow);
  const requestedWindowRejected =
    params.requestedTimeWindow !== null &&
    params.requestedTimeWindow !== undefined &&
    !parsedTw.ok &&
    parsedTw.error !== 'missing';

  if (parsedTw.ok) {
    resolved = applyRequestedTimeWindow(resolved, parsedTw.window);
  }

  const window = resolved.timeWindow;
  const keyword = pickSearchKeyword(params.queryText);

  const [
    farmTimezone,
    cycle,
    scopeHint,
    recentEvents,
    anomalyContext,
    sensorContext,
    photoContext,
    photoTimelineSignals,
    sopContext,
    dailyTimelines,
  ] = await Promise.all([
    fetchFarmTimezone(supabase, params.farmId),
    fetchCycle(supabase, params.farmId, params.cycleId),
    fetchScopeHint(supabase, params.farmId, params.scopeId),
    fetchRecentEvents(supabase, {
      farmId: params.farmId,
      cycleId: params.cycleId,
      scopeId: params.scopeId,
      window,
    }),
    fetchAnomalyEvents(supabase, {
      farmId: params.farmId,
      cycleId: params.cycleId,
      scopeId: params.scopeId,
      window,
    }),
    fetchSensorReadings(supabase, {
      farmId: params.farmId,
      cycleId: params.cycleId,
      scopeId: params.scopeId,
      window,
    }),
    fetchPhotosWithAnalysis(supabase, {
      farmId: params.farmId,
      cycleId: params.cycleId,
      scopeId: params.scopeId,
      limit: intentMeta.requiresPhotoContext ? 12 : 6,
      window,
    }),
    fetchPhotoTimelineSignals(supabase, {
      farmId: params.farmId,
      cycleId: params.cycleId,
      scopeId: params.scopeId,
      window,
    }),
    fetchSopContextRows(supabase, params.farmId, params.cycleId),
    fetchDailyTimelines(supabase, {
      farmId: params.farmId,
      cycleId: params.cycleId,
      scopeId: params.scopeId,
      window,
    }),
  ]);

  const eventIdsForChildren = [
    ...new Set([
      ...recentEvents.map((e) => e.id),
      ...anomalyContext.map((e) => e.id),
    ]),
  ].slice(0, 40);

  const [observations, recentActions, causalContext] = await Promise.all([
    fetchObservationsForEventIds(supabase, params.farmId, eventIdsForChildren, window),
    fetchActionsForEventIds(supabase, params.farmId, eventIdsForChildren, window),
    intentMeta.intentType === 'causal' || intentMeta.intentType === 'planning'
      ? fetchCausalLinks(supabase, params.farmId, eventIdsForChildren)
      : Promise.resolve([]),
  ]);

  let historicalContext = { pastCycles: [] as AnswerAssemblyContext['historicalContext']['pastCycles'], patternInsights: [] as AnswerAssemblyContext['historicalContext']['patternInsights'] };
  if (intentMeta.requiresHistoricalContext) {
    const [pastCycles, patternInsights] = await Promise.all([
      fetchHistoricalCycles(supabase, params.farmId, params.cycleId),
      fetchPatternInsights(supabase, params.farmId),
    ]);
    historicalContext = { pastCycles, patternInsights };
  }

  let knowledgeContext = [] as AnswerAssemblyContext['knowledgeContext'];
  let memoryContext = [] as AnswerAssemblyContext['memoryContext'];

  if (
    intentMeta.requiresKnowledgeContext ||
    intentMeta.intentType === 'exploration' ||
    intentMeta.intentType === 'planning'
  ) {
    const docs = await fetchSearchableDocuments(supabase, {
      farmId: params.farmId,
      cycleId: params.cycleId,
      keyword,
      wantKnowledge: intentMeta.requiresKnowledgeContext || intentMeta.intentType === 'exploration',
      wantMemory: intentMeta.requiresHistoricalContext || intentMeta.intentType === 'planning',
    });
    knowledgeContext = docs.knowledge;
    memoryContext = docs.memory;
  }

  const currentState = {
    cycleStage: cycle?.stage ?? null,
    cycleName: cycle?.name ?? null,
    cycleStatus: cycle?.status ?? null,
    summary: cycle
      ? `${cycle.name} · стадия ${cycle.stage} · статус ${cycle.status}`
      : null,
  };

  const scopeUi = scopeHint
    ? { id: scopeHint.id, displayName: scopeHint.display_name }
    : null;

  const base: AnswerAssemblyContext = {
    assembledAtIso: new Date().toISOString(),
    farmTimezone,
    retrievalSession: {
      userId: params.userId,
      conversationId: params.conversationId ?? null,
    },
    request: {
      queryText: params.queryText,
      intentType: intentMeta.intentType,
      subIntents: intentMeta.subIntents,
      diagnosticRiskLevel: intentMeta.diagnosticRiskLevel,
    },
    scope: resolved,
    scopeUi,
    intentMeta,
    currentState,
    recentEvents,
    sensorContext,
    photoContext,
    photoTimelineSignals,
    sopContext,
    anomalyContext,
    causalContext,
    historicalContext,
    memoryContext,
    knowledgeContext,
    observations,
    recentActions,
    dailyTimelines,
    missingData: [],
    guardrails: {
      mustNotClaimWithoutEvidence: true,
      mustAskClarifyingQuestionIfScopeAmbiguous: false,
      blockStrongCausalOrActionWithoutSignals: false,
      blockFarmActionAdviceWithoutCycle: false,
    },
  };

  const { guardrails, missingData } = buildGuardrailsAndMissingData(
    intentMeta,
    { cycleId: params.cycleId, needsClarification: resolved.needsClarification },
    base
  );

  const extraMissing: string[] = [];
  if (requestedWindowRejected && !parsedTw.ok) {
    extraMissing.push(
      `Клиент передал requested_time_window, но оно отклонено (${parsedTw.error}) — использовано окно по intent.`
    );
  }

  return {
    ...base,
    guardrails,
    missingData: [...missingData, ...extraMissing],
  };
}
