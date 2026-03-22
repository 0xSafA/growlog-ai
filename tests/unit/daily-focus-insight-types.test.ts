import { describe, expect, it } from 'vitest';
import { DAILY_FOCUS_INSIGHT_TYPES } from '@/lib/growlog/daily-focus-insights';

/** Должно совпадать с check `ai_insights_insight_type` в миграции (кроме исключённых вручную). */
const ALLOWED_IN_DB = new Set([
  'summary',
  'recommendation',
  'causal_explanation',
  'clarification_request',
  'evidence_summary',
  'pattern',
  'risk',
  'daily_focus',
  'anomaly',
  'other',
  'story_block',
]);

describe('DAILY_FOCUS_INSIGHT_TYPES', () => {
  it('has unique entries', () => {
    expect(new Set(DAILY_FOCUS_INSIGHT_TYPES).size).toBe(DAILY_FOCUS_INSIGHT_TYPES.length);
  });

  it('every type is allowed by DB constraint', () => {
    for (const t of DAILY_FOCUS_INSIGHT_TYPES) {
      expect(ALLOWED_IN_DB.has(t), `unknown insight_type: ${t}`).toBe(true);
    }
  });

  it('excludes clarification_request (assistant dialog, not focus card)', () => {
    expect(DAILY_FOCUS_INSIGHT_TYPES.includes('clarification_request' as never)).toBe(false);
  });
});
