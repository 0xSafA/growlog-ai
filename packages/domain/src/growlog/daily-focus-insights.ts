/**
 * Типы `ai_insights`, которые показываются в карточке «Фокус ИИ» на главной.
 * Должны быть подмножеством check-ограничения в миграции `ai_insights_insight_type_check`
 * (summary, recommendation, causal_explanation, …, story_block).
 *
 * Не включаем `clarification_request` — это сценарий диалога в ассистенте, не карточка фокуса.
 */
export const DAILY_FOCUS_INSIGHT_TYPES = [
  'daily_focus',
  'risk',
  'anomaly',
  'recommendation',
  'summary',
  'evidence_summary',
  'pattern',
  'causal_explanation',
  'story_block',
  'other',
] as const;

export type DailyFocusInsightType = (typeof DAILY_FOCUS_INSIGHT_TYPES)[number];
