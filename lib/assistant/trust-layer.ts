import type { AnswerAssemblyContext } from '@/types/retrieval-assembly';
import type { AssistantModelResponse } from '@/lib/assistant/response-schema';

/** ADR-004 — флаги, которые модель или правила могут выставить. */
export const KNOWN_TRUST_FLAGS = [
  'low_confidence',
  'missing_scope',
  'missing_recent_signal',
  'conflicting_evidence',
  'requires_user_confirmation',
  'safe_to_store',
  'ephemeral_only',
] as const;

const EPHEMERAL_INSIGHT_TYPES = new Set<string>(['clarification_request', 'other']);

/** Типы, которые по умолчанию можно сохранять при наличии grounding (ADR-004 What gets stored). */
const PERSISTIBLE_INSIGHT_TYPES = new Set<string>([
  'summary',
  'recommendation',
  'causal_explanation',
  'evidence_summary',
  'pattern',
  'risk',
  'daily_focus',
  'anomaly',
  'story_block',
]);

function uniqStrings(items: string[]): string[] {
  return [...new Set(items.map((s) => s.trim()).filter(Boolean))];
}

function addFlags(existing: string[], add: string[]): string[] {
  return uniqStrings([...existing, ...add]);
}

export type PersistenceReason =
  | 'stored_high_value'
  | 'skipped_ephemeral_type'
  | 'skipped_no_grounding'
  | 'skipped_trust_ephemeral_only'
  | 'skipped_other_type'
  /** Запись в ai_insights не удалась (схема БД, RLS, сеть). Ответ пользователю всё равно отдан. */
  | 'persist_insert_failed'
  /** Строка ai_insights откатана: insight_grounding не вставился (ADR-004: не хранить инсайт без связей). */
  | 'grounding_attach_failed';

export type TrustLayerResult = {
  response: AssistantModelResponse;
  persistInsight: boolean;
  persistenceReason: PersistenceReason;
};

/**
 * ADR-004 §8 Trust Layer — детерминированные проверки поверх ответа модели и assembled context.
 * LLM даёт формулировки; правила — safety и persistence.
 */
export function applyTrustLayer(
  parsed: AssistantModelResponse,
  pack: AnswerAssemblyContext
): TrustLayerResult {
  const g = pack.guardrails;

  let insight_type = parsed.insight_type;
  let body = parsed.body;
  let title = parsed.title;
  let facts = [...parsed.facts];
  let interpretation = parsed.interpretation;
  let hypotheses = parsed.hypotheses.slice(0, 4);
  let recommendation = parsed.recommendation;
  let confidence = { ...parsed.confidence };
  let missing_data = uniqStrings([...pack.missingData, ...parsed.missing_data]);
  let grounding = [...parsed.grounding];
  let trust_flags = [...parsed.trust_flags];

  if (g.mustAskClarifyingQuestionIfScopeAmbiguous) {
    trust_flags = addFlags(trust_flags, ['missing_scope']);
  }

  if (g.blockStrongCausalOrActionWithoutSignals) {
    trust_flags = addFlags(trust_flags, ['missing_recent_signal']);
    if (recommendation) {
      recommendation = null;
    }
    if (confidence.label === 'high') {
      confidence = {
        label: 'low',
        score: Math.min(confidence.score, 0.42),
      };
    } else if (confidence.label === 'medium') {
      confidence = {
        label: 'low',
        score: Math.min(confidence.score, 0.55),
      };
    }
    if (
      insight_type === 'recommendation' ||
      insight_type === 'causal_explanation'
    ) {
      insight_type = 'clarification_request';
      if (!title) {
        title = 'Нужны данные для уверенного ответа';
      }
    }
  }

  let downgradedToClarificationForCycle = false;

  if (g.blockFarmActionAdviceWithoutCycle) {
    if (recommendation) {
      recommendation = null;
    }
    trust_flags = addFlags(trust_flags, ['requires_user_confirmation']);
    if (insight_type === 'recommendation') {
      insight_type = 'clarification_request';
      downgradedToClarificationForCycle = true;
      if (!title) {
        title = 'Уточните цикл';
      }
    }
  }

  if (insight_type !== parsed.insight_type && insight_type === 'clarification_request') {
    const fromSignals =
      g.blockStrongCausalOrActionWithoutSignals &&
      (parsed.insight_type === 'recommendation' ||
        parsed.insight_type === 'causal_explanation');
    const note = fromSignals
      ? '_(Вывод ослаблен политикой доверия: недостаточно опоры в данных для сильных выводов.)_'
      : downgradedToClarificationForCycle
        ? '_(Вывод ослаблен политикой доверия: для операционных советов по циклу нужен выбранный активный цикл.)_'
        : '_(Вывод приведён к уточнению по политике доверия.)_';
    body = `${note}\n\n${body}`;
  }

  if (grounding.length === 0) {
    trust_flags = addFlags(trust_flags, ['low_confidence']);
  }

  if (trust_flags.includes('ephemeral_only')) {
    return finalize(
      {
        insight_type,
        title,
        body,
        facts,
        interpretation,
        hypotheses,
        recommendation,
        confidence,
        missing_data,
        grounding,
        trust_flags: uniqStrings(trust_flags),
      },
      false,
      'skipped_trust_ephemeral_only'
    );
  }

  const persistDecision = decidePersistence({
    insight_type,
    groundingCount: grounding.length,
  });

  return finalize(
    {
      insight_type,
      title,
      body,
      facts,
      interpretation,
      hypotheses,
      recommendation,
      confidence,
      missing_data,
      grounding,
      trust_flags: uniqStrings(trust_flags),
    },
    persistDecision.ok,
    persistDecision.reason
  );
}

function finalize(
  response: AssistantModelResponse,
  persistInsight: boolean,
  persistenceReason: PersistenceReason
): TrustLayerResult {
  return { response, persistInsight, persistenceReason };
}

function decidePersistence(params: {
  insight_type: string;
  groundingCount: number;
}): { ok: boolean; reason: PersistenceReason } {
  if (params.groundingCount < 1) {
    return { ok: false, reason: 'skipped_no_grounding' };
  }
  if (EPHEMERAL_INSIGHT_TYPES.has(params.insight_type)) {
    return { ok: false, reason: 'skipped_ephemeral_type' };
  }
  if (!PERSISTIBLE_INSIGHT_TYPES.has(params.insight_type)) {
    return { ok: false, reason: 'skipped_other_type' };
  }
  return { ok: true, reason: 'stored_high_value' };
}
