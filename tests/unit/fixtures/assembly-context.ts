import type {
  AnswerAssemblyContext,
  AssemblyGuardrails,
  IntentClassification,
  ResolvedQueryScope,
} from '@/types/retrieval-assembly';

const defaultScope: ResolvedQueryScope = {
  farmId: '00000000-0000-4000-8000-000000000001',
  cycleId: '00000000-0000-4000-8000-000000000002',
  scopeId: null,
  timeWindow: { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' },
  timeWindowSource: 'intent',
  needsClarification: false,
  clarificationHint: null,
};

const defaultIntent: IntentClassification = {
  intentType: 'status',
  subIntents: [],
  diagnosticRiskLevel: 'low',
  requiresHistoricalContext: false,
  requiresKnowledgeContext: false,
  requiresSopContext: false,
  requiresPhotoContext: false,
  retrievalOnlyOutput: false,
};

const defaultGuardrails: AssemblyGuardrails = {
  mustNotClaimWithoutEvidence: true,
  mustAskClarifyingQuestionIfScopeAmbiguous: false,
  blockStrongCausalOrActionWithoutSignals: false,
  blockFarmActionAdviceWithoutCycle: false,
};

/**
 * Minimal valid `AnswerAssemblyContext` for unit tests (ADR-003 pack shape).
 */
export function makeAnswerAssemblyContext(
  overrides: Partial<AnswerAssemblyContext> = {}
): AnswerAssemblyContext {
  const {
    scope: scopeOverride,
    intentMeta: intentOverride,
    guardrails: guardrailsOverride,
    ...restOverrides
  } = overrides;

  const base: AnswerAssemblyContext = {
    assembledAtIso: '2026-03-22T12:00:00.000Z',
    farmTimezone: 'UTC',
    retrievalSession: { userId: 'test-user', conversationId: null },
    request: {
      queryText: 'test',
      intentType: 'status',
      subIntents: [],
      diagnosticRiskLevel: 'low',
    },
    scope: defaultScope,
    scopeUi: null,
    intentMeta: defaultIntent,
    currentState: {
      cycleStage: null,
      cycleName: null,
      cycleStatus: null,
      summary: null,
    },
    recentEvents: [],
    sensorContext: [],
    photoContext: [],
    photoTimelineSignals: [],
    sopContext: [],
    anomalyContext: [],
    causalContext: [],
    historicalContext: { pastCycles: [], patternInsights: [] },
    memoryContext: [],
    knowledgeContext: [],
    observations: [],
    recentActions: [],
    dailyTimelines: [],
    missingData: [],
    guardrails: defaultGuardrails,
  };

  return {
    ...base,
    ...restOverrides,
    scope: scopeOverride ?? defaultScope,
    intentMeta: intentOverride ?? defaultIntent,
    guardrails: { ...defaultGuardrails, ...guardrailsOverride },
  };
}

export { defaultGuardrails, defaultIntent, defaultScope };
