import { describe, expect, it } from 'vitest';
import { applyTrustLayer } from '@/lib/assistant/trust-layer';
import type { AssistantModelResponse } from '@/lib/assistant/response-schema';
import { makeAnswerAssemblyContext } from './fixtures/assembly-context';

function baseModel(overrides: Partial<AssistantModelResponse> = {}): AssistantModelResponse {
  return {
    insight_type: 'summary',
    title: null,
    body: 'Тестовый ответ ассистента.',
    facts: [],
    interpretation: null,
    hypotheses: [],
    recommendation: null,
    confidence: { score: 0.72, label: 'medium' },
    missing_data: [],
    grounding: [
      {
        source_type: 'event',
        source_id: '00000000-0000-4000-8000-000000000099',
        excerpt: 'событие',
      },
    ],
    trust_flags: [],
    ...overrides,
  };
}

/**
 * ADR-004: детерминированный trust layer — grounding, ephemeral_only, блокировка сильных выводов.
 */
describe('applyTrustLayer (ADR-004)', () => {
  it('добавляет low_confidence при пустом grounding', () => {
    const parsed = baseModel({ grounding: [] });
    const pack = makeAnswerAssemblyContext();
    const { response, persistInsight, persistenceReason } = applyTrustLayer(parsed, pack);
    expect(response.trust_flags).toContain('low_confidence');
    expect(persistInsight).toBe(false);
    expect(persistenceReason).toBe('skipped_no_grounding');
  });

  it('не сохраняет при ephemeral_only', () => {
    const parsed = baseModel({
      trust_flags: ['ephemeral_only'],
      insight_type: 'summary',
    });
    const pack = makeAnswerAssemblyContext();
    const { persistInsight, persistenceReason } = applyTrustLayer(parsed, pack);
    expect(persistInsight).toBe(false);
    expect(persistenceReason).toBe('skipped_trust_ephemeral_only');
  });

  it('сохраняет high-value тип при наличии grounding и без ephemeral', () => {
    const parsed = baseModel({ insight_type: 'recommendation' });
    const pack = makeAnswerAssemblyContext();
    const { persistInsight, persistenceReason } = applyTrustLayer(parsed, pack);
    expect(persistInsight).toBe(true);
    expect(persistenceReason).toBe('stored_high_value');
  });

  it('не сохраняет clarification_request как ephemeral type', () => {
    const parsed = baseModel({
      insight_type: 'clarification_request',
      grounding: [{ source_type: 'event', source_id: null, excerpt: 'x' }],
    });
    const pack = makeAnswerAssemblyContext();
    const { persistInsight, persistenceReason } = applyTrustLayer(parsed, pack);
    expect(persistInsight).toBe(false);
    expect(persistenceReason).toBe('skipped_ephemeral_type');
  });

  it('blockStrongCausalOrActionWithoutSignals: снимает recommendation и понижает causal/recommendation к clarification', () => {
    const parsed = baseModel({
      insight_type: 'recommendation',
      title: null,
      body: 'Совет',
      recommendation: 'Полить',
      confidence: { score: 0.9, label: 'high' },
    });
    const pack = makeAnswerAssemblyContext({
      guardrails: {
        mustNotClaimWithoutEvidence: true,
        mustAskClarifyingQuestionIfScopeAmbiguous: false,
        blockStrongCausalOrActionWithoutSignals: true,
        blockFarmActionAdviceWithoutCycle: false,
      },
    });
    const { response } = applyTrustLayer(parsed, pack);
    expect(response.insight_type).toBe('clarification_request');
    expect(response.recommendation).toBeNull();
    expect(response.confidence.label).toBe('low');
    expect(response.body).toMatch(/политикой доверия/);
    expect(response.trust_flags).toContain('missing_recent_signal');
  });

  it('blockFarmActionAdviceWithoutCycle: action без цикла — recommendation снят, тип recommendation → clarification', () => {
    const parsed = baseModel({
      insight_type: 'recommendation',
      recommendation: 'Сделай X',
    });
    const pack = makeAnswerAssemblyContext({
      scope: {
        farmId: '00000000-0000-4000-8000-000000000001',
        cycleId: null,
        scopeId: null,
        timeWindow: { from: '2026-01-01T00:00:00.000Z', to: '2026-01-02T00:00:00.000Z' },
        timeWindowSource: 'intent',
        needsClarification: false,
        clarificationHint: null,
      },
      guardrails: {
        mustNotClaimWithoutEvidence: true,
        mustAskClarifyingQuestionIfScopeAmbiguous: false,
        blockStrongCausalOrActionWithoutSignals: false,
        blockFarmActionAdviceWithoutCycle: true,
      },
    });
    const { response } = applyTrustLayer(parsed, pack);
    expect(response.insight_type).toBe('clarification_request');
    expect(response.recommendation).toBeNull();
    expect(response.trust_flags).toContain('requires_user_confirmation');
    expect(response.body).toMatch(/активный цикл/);
  });

  it('mustAskClarifyingQuestionIfScopeAmbiguous добавляет missing_scope', () => {
    const parsed = baseModel();
    const pack = makeAnswerAssemblyContext({
      guardrails: {
        mustNotClaimWithoutEvidence: true,
        mustAskClarifyingQuestionIfScopeAmbiguous: true,
        blockStrongCausalOrActionWithoutSignals: false,
        blockFarmActionAdviceWithoutCycle: false,
      },
    });
    const { response } = applyTrustLayer(parsed, pack);
    expect(response.trust_flags).toContain('missing_scope');
  });
});
