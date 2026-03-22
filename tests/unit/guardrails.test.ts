import { describe, expect, it } from 'vitest';
import { buildGuardrailsAndMissingData } from '@/lib/growlog/retrieval/guardrails';
import type { IntentClassification } from '@/types/retrieval-assembly';
import { makeAnswerAssemblyContext } from './fixtures/assembly-context';

function intent(overrides: Partial<IntentClassification>): IntentClassification {
  return {
    intentType: 'status',
    subIntents: [],
    diagnosticRiskLevel: 'low',
    requiresHistoricalContext: false,
    requiresKnowledgeContext: false,
    requiresSopContext: false,
    requiresPhotoContext: false,
    retrievalOnlyOutput: false,
    ...overrides,
  };
}

/**
 * ADR-003: детерминированные guardrails и missing_data при сборке контекста.
 */
describe('buildGuardrailsAndMissingData (ADR-003)', () => {
  it('помечает ambiguous scope и заполняет missingData', () => {
    const ctx = makeAnswerAssemblyContext();
    const { guardrails, missingData } = buildGuardrailsAndMissingData(
      intent({ intentType: 'status' }),
      { cycleId: '00000000-0000-4000-8000-000000000002', needsClarification: true },
      ctx
    );
    expect(guardrails.mustAskClarifyingQuestionIfScopeAmbiguous).toBe(true);
    expect(missingData.some((m) => m.includes('уточнить scope'))).toBe(true);
  });

  it('для action без cycleId добавляет missing и blockFarmActionAdviceWithoutCycle', () => {
    const ctx = makeAnswerAssemblyContext({
      sensorContext: [],
    });
    const { guardrails, missingData } = buildGuardrailsAndMissingData(
      intent({ intentType: 'action' }),
      { cycleId: null, needsClarification: false },
      ctx
    );
    expect(guardrails.blockFarmActionAdviceWithoutCycle).toBe(true);
    expect(missingData.some((m) => m.includes('Не выбран активный цикл'))).toBe(true);
  });

  it('диагностический causal medium без событий и сигналов — blockStrongCausalOrActionWithoutSignals', () => {
    const ctx = makeAnswerAssemblyContext({
      recentEvents: [],
      sensorContext: [],
      photoContext: [],
      sopContext: [],
      anomalyContext: [],
      observations: [],
    });
    const { guardrails, missingData } = buildGuardrailsAndMissingData(
      intent({ intentType: 'causal', diagnosticRiskLevel: 'medium' }),
      { cycleId: '00000000-0000-4000-8000-000000000002', needsClarification: false },
      ctx
    );
    expect(guardrails.blockStrongCausalOrActionWithoutSignals).toBe(true);
    expect(
      missingData.some((m) => m.includes('недавнее событие') && m.includes('сигнал'))
    ).toBe(true);
  });

  it('при наличии сенсора и события диагностический causal medium не блокируется', () => {
    const ctx = makeAnswerAssemblyContext({
      recentEvents: [
        {
          id: 'e1',
          occurredAt: '2026-01-01T12:00:00.000Z',
          eventType: 'note',
          title: null,
          body: 'x',
          scopeId: null,
          severity: null,
          relevanceScore: 1,
        },
      ],
      sensorContext: [
        {
          id: 's1',
          capturedAt: '2026-01-01T12:00:00.000Z',
          metricCode: 'temp',
          metricName: 'Temp',
          valueNumeric: 22,
          unit: 'C',
          scopeId: null,
          relevanceScore: 1,
        },
      ],
    });
    const { guardrails } = buildGuardrailsAndMissingData(
      intent({ intentType: 'causal', diagnosticRiskLevel: 'medium' }),
      { cycleId: '00000000-0000-4000-8000-000000000002', needsClarification: false },
      ctx
    );
    expect(guardrails.blockStrongCausalOrActionWithoutSignals).toBe(false);
  });

  it('requiresPhotoContext без фото — missing про фото', () => {
    const ctx = makeAnswerAssemblyContext({ photoContext: [] });
    const { missingData } = buildGuardrailsAndMissingData(
      intent({ intentType: 'status', requiresPhotoContext: true }),
      { cycleId: '00000000-0000-4000-8000-000000000002', needsClarification: false },
      ctx
    );
    expect(missingData.some((m) => m.includes('Нет недавних фото'))).toBe(true);
  });

  it('фото без analysis и без failed/processing — не выдумывать визуальные признаки', () => {
    const ctx = makeAnswerAssemblyContext({
      photoContext: [
        {
          id: 'p1',
          mediaAssetId: '00000000-0000-4000-8000-0000000000aa',
          capturedAt: '2026-01-01T12:00:00.000Z',
          fileName: 'x.jpg',
          analysisSummary: null,
          tags: [],
          analysisStatus: 'saved_unanalyzed',
          analysisConfidence: null,
          relevanceScore: 1,
        },
      ],
    });
    const { missingData } = buildGuardrailsAndMissingData(
      intent({ intentType: 'status', requiresPhotoContext: true }),
      { cycleId: '00000000-0000-4000-8000-000000000002', needsClarification: false },
      ctx
    );
    expect(missingData.some((m) => m.includes('нет photo_analysis'))).toBe(true);
  });
});
