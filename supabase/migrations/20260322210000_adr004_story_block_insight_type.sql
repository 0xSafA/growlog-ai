-- ADR-004: story_block as persisted narrative insight for reports.

alter table public.ai_insights
  drop constraint if exists ai_insights_insight_type_check;

alter table public.ai_insights
  add constraint ai_insights_insight_type_check
  check (insight_type in (
    'summary', 'recommendation', 'causal_explanation', 'clarification_request',
    'evidence_summary', 'pattern', 'risk', 'daily_focus', 'anomaly', 'other',
    'story_block'
  ));
