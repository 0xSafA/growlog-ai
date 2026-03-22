/**
 * ADR-003: canonical retrieval assembly blocks (stable keys for prompts & tests).
 */

export const RETRIEVAL_INTENTS = [
  'status',
  'causal',
  'action',
  'planning',
  'report',
  'exploration',
  'sop_execution_dialog',
  'daily_focus',
  'unknown',
] as const;

export type RetrievalIntentType = (typeof RETRIEVAL_INTENTS)[number];

export type TimeWindowIso = {
  from: string;
  to: string;
};

/** Откуда взято окно времени (ADR-003: intent vs явный запрос клиента). */
export type TimeWindowSource = 'intent' | 'requested';

/** Stage 1 — scope resolution */
export type ResolvedQueryScope = {
  farmId: string;
  cycleId: string | null;
  scopeId: string | null;
  timeWindow: TimeWindowIso;
  timeWindowSource: TimeWindowSource;
  needsClarification: boolean;
  clarificationHint: string | null;
};

/** Stage 2 — intent classification */
export type IntentClassification = {
  intentType: RetrievalIntentType;
  subIntents: RetrievalIntentType[];
  diagnosticRiskLevel: 'low' | 'medium' | 'high';
  requiresHistoricalContext: boolean;
  requiresKnowledgeContext: boolean;
  requiresSopContext: boolean;
  requiresPhotoContext: boolean;
  retrievalOnlyOutput: boolean;
};

export type CurrentStateBlock = {
  cycleStage: string | null;
  cycleName: string | null;
  cycleStatus: string | null;
  summary: string | null;
};

export type ScoredLine<T> = T & { relevanceScore: number };

export type RecentEventItem = {
  id: string;
  occurredAt: string;
  eventType: string;
  title: string | null;
  body: string | null;
  scopeId: string | null;
  severity: string | null;
};

export type SensorContextItem = {
  id: string;
  capturedAt: string;
  metricCode: string;
  metricName: string;
  valueNumeric: number;
  unit: string | null;
  scopeId: string | null;
};

export type PhotoContextItem = {
  /** same as mediaAssetId — for scoring / stable keys */
  id: string;
  mediaAssetId: string;
  capturedAt: string | null;
  fileName: string | null;
  analysisSummary: string | null;
  tags: string[];
  /** ADR-010: saved_unanalyzed | processing_analysis | analysis_ready | analysis_failed */
  analysisStatus: string | null;
  analysisConfidence: number | null;
};

/** ADR-010: derived temporal hypotheses between two frames (not causal proof). */
export type PhotoTimelineSignalItem = {
  id: string;
  fromMediaAssetId: string;
  toMediaAssetId: string;
  scopeId: string | null;
  signalType: string;
  signalStrength: number | null;
  description: string | null;
};

export type SopContextItem = {
  runId: string;
  definitionTitle: string;
  status: string;
  dueAt: string | null;
  reasonText: string | null;
  scopeId: string | null;
};

export type AnomalyContextItem = {
  id: string;
  occurredAt: string;
  eventType: string;
  title: string | null;
  body: string | null;
  severity: string | null;
};

export type CausalLinkItem = {
  id: string;
  fromEventId: string;
  toEventId: string;
  relationType: string;
};

export type HistoricalCycleItem = {
  id: string;
  name: string;
  stage: string;
  /** ISO date string (date column) */
  startDate: string;
  endDate: string | null;
  status: string;
};

export type MemoryContextItem = {
  id: string;
  docType: string;
  title: string | null;
  excerpt: string;
};

export type KnowledgeContextItem = {
  id: string;
  docType: string;
  title: string | null;
  excerpt: string;
};

export type ObservationItem = {
  id: string;
  eventId: string;
  observationType: string;
  label: string | null;
  valueText: string | null;
};

export type ActionLogItem = {
  id: string;
  eventId: string;
  actionType: string;
  resultText: string | null;
  completedAt: string | null;
  createdAt: string;
};

export type DailyTimelineItem = {
  id: string;
  timelineDate: string;
  summaryText: string | null;
  eventCount: number;
  anomalyCount: number;
};

export type AiInsightRefItem = {
  id: string;
  insightType: string;
  title: string | null;
  bodyExcerpt: string;
  createdAt: string;
};

export type AssemblyGuardrails = {
  mustNotClaimWithoutEvidence: boolean;
  mustAskClarifyingQuestionIfScopeAmbiguous: boolean;
  blockStrongCausalOrActionWithoutSignals: boolean;
  blockFarmActionAdviceWithoutCycle: boolean;
};

/**
 * Full assembled context for LLM (ADR-003 § Assembly output format).
 */
/** Канонические входы ADR-003 + проводка для аудита и будущего dialog-aware retrieval. */
export type RetrievalSessionMeta = {
  userId: string;
  conversationId: string | null;
};

export type AnswerAssemblyContext = {
  assembledAtIso: string;
  farmTimezone: string;
  retrievalSession: RetrievalSessionMeta;
  request: {
    queryText: string;
    intentType: RetrievalIntentType;
    subIntents: RetrievalIntentType[];
    diagnosticRiskLevel: 'low' | 'medium' | 'high';
  };
  scope: ResolvedQueryScope;
  /** Подпись выбранного scope из БД (если передан scope_id). */
  scopeUi: { id: string; displayName: string } | null;
  intentMeta: IntentClassification;
  currentState: CurrentStateBlock;
  recentEvents: ScoredLine<RecentEventItem>[];
  sensorContext: ScoredLine<SensorContextItem>[];
  photoContext: ScoredLine<PhotoContextItem>[];
  /** ADR-010: pairwise visual dynamics (scope/time filtered in fetch). */
  photoTimelineSignals: PhotoTimelineSignalItem[];
  sopContext: ScoredLine<SopContextItem>[];
  anomalyContext: ScoredLine<AnomalyContextItem>[];
  /** event_links (causal layer; ADR causal_links not in DB — use event_links) */
  causalContext: CausalLinkItem[];
  historicalContext: {
    pastCycles: HistoricalCycleItem[];
    patternInsights: AiInsightRefItem[];
  };
  memoryContext: ScoredLine<MemoryContextItem>[];
  knowledgeContext: ScoredLine<KnowledgeContextItem>[];
  /** Intent-specific extras */
  observations: ScoredLine<ObservationItem>[];
  recentActions: ScoredLine<ActionLogItem>[];
  dailyTimelines: DailyTimelineItem[];
  missingData: string[];
  guardrails: AssemblyGuardrails;
};
