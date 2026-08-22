import type { SupabaseClient } from '@supabase/supabase-js';
import { DAILY_FOCUS_INSIGHT_TYPES } from './daily-focus-insights';

export type DailyFocusInsightRow = {
  id: string;
  title: string | null;
  body: string;
  insight_type: string;
  confidence: number | null;
  confidence_label: string | null;
  created_at: string;
};

export type InsightGroundingRow = {
  source_type: string;
  source_id: string | null;
  excerpt: string | null;
};

export async function fetchDailyFocusInsights(
  supabase: SupabaseClient,
  params: { farmId: string; cycleId: string; limit?: number }
): Promise<DailyFocusInsightRow[]> {
  const { data, error } = await supabase
    .from('ai_insights')
    .select('id, title, body, insight_type, confidence, confidence_label, created_at')
    .eq('farm_id', params.farmId)
    .eq('cycle_id', params.cycleId)
    .in('insight_type', [...DAILY_FOCUS_INSIGHT_TYPES])
    .order('created_at', { ascending: false })
    .limit(params.limit ?? 8);
  if (error) throw error;
  return (data ?? []) as DailyFocusInsightRow[];
}

export async function fetchInsightGrounding(
  supabase: SupabaseClient,
  insightId: string,
  limit = 8
): Promise<InsightGroundingRow[]> {
  const { data, error } = await supabase
    .from('insight_grounding')
    .select('source_type, source_id, excerpt')
    .eq('insight_id', insightId)
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as InsightGroundingRow[];
}
