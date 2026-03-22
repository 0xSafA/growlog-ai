import type { AnswerAssemblyContext } from '@/types/retrieval-assembly';
import type { AssistantModelResponse } from '@/lib/assistant/response-schema';

/**
 * Нет ни одной опорной сущности в выборке — LLM не сможет «приземлить» ответ (ADR-003/004).
 */
export function isRetrievalEmptyForAdvice(pack: AnswerAssemblyContext): boolean {
  const hasTimelineText = pack.dailyTimelines.some(
    (t) => (t.summaryText?.trim()?.length ?? 0) > 0
  );
  if (hasTimelineText) return false;

  if (
    pack.historicalContext.pastCycles.length > 0 ||
    pack.historicalContext.patternInsights.length > 0
  ) {
    return false;
  }
  if (pack.photoTimelineSignals.length > 0) {
    return false;
  }

  return (
    pack.recentEvents.length === 0 &&
    pack.anomalyContext.length === 0 &&
    pack.sensorContext.length === 0 &&
    pack.sopContext.length === 0 &&
    pack.photoContext.length === 0 &&
    pack.observations.length === 0 &&
    pack.recentActions.length === 0 &&
    pack.knowledgeContext.length === 0 &&
    pack.memoryContext.length === 0 &&
    pack.dailyTimelines.length === 0 &&
    pack.causalContext.length === 0
  );
}

/** Когда Stage 1 вернёт needsClarification (несколько scope) — без LLM. */
export function buildScopeClarificationResponse(
  pack: AnswerAssemblyContext,
  message: string
): AssistantModelResponse {
  const hint =
    pack.scope.clarificationHint?.trim() ||
    'Выберите конкретную зону/scope в интерфейсе или уточните вопрос.';
  return {
    insight_type: 'clarification_request',
    title: 'Нужно уточнить scope',
    body:
      `Вопрос допускает несколько равновероятных трактовок по зонам фермы.\n\n${hint}\n\n` +
      `_(Ваш вопрос: ${message})_`,
    facts: [],
    interpretation: null,
    hypotheses: [],
    recommendation: null,
    confidence: { score: 0.2, label: 'low' },
    missing_data: pack.missingData,
    grounding: [],
    trust_flags: ['missing_scope', 'low_confidence'],
  };
}

/** Пустой retrieval — краткий evidence_summary без вызова модели. */
export function buildEmptyRetrievalResponse(
  pack: AnswerAssemblyContext
): AssistantModelResponse {
  const md = pack.missingData;
  const mdLine =
    md.length > 0 ? `\n\n**Замечания системы:** ${md.map((s) => `• ${s}`).join(' ')}` : '';
  return {
    insight_type: 'evidence_summary',
    title: 'Нет данных в выбранном контексте',
    body:
      `В выбранном окне времени и фильтрах **нет событий, замеров, SOP, фото и связанных записей** для опоры ответа.` +
      mdLine +
      '\n\nДобавьте записи в журнал, подключите датчики или расширьте период (`requested_time_window`), затем повторите вопрос.',
    facts: md.slice(0, 8),
    interpretation: null,
    hypotheses: [],
    recommendation: null,
    confidence: { score: 0.12, label: 'low' },
    missing_data: md,
    grounding: [],
    trust_flags: ['low_confidence', 'missing_recent_signal'],
  };
}
