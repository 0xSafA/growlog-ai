import type { SupabaseClient } from '@supabase/supabase-js';
import type { GroundingItemParsed } from '@/lib/assistant/response-schema';

type InsertInsightRow = {
  farm_id: string;
  cycle_id: string | null;
  scope_id: string | null;
  insight_type: string;
  title: string | null;
  body: string;
  user_query: string;
  facts_json: unknown;
  interpretation_json: unknown;
  recommendation_json: unknown;
  hypotheses_json: unknown;
  confidence: number;
  confidence_label: string;
  missing_data_json: unknown;
  trust_flags_json: unknown;
  model_name: string;
  created_by: string;
  grounding: GroundingItemParsed[];
};

/**
 * Одна транзакция в БД (RPC). При отсутствии функции — fallback на двухшаговую вставку с откатом.
 */
export async function insertInsightWithGrounding(
  supabase: SupabaseClient,
  row: InsertInsightRow
): Promise<{
  insightId: string | null;
  error: string | null;
  usedRpc: boolean;
  /** Ошибка на шаге связки grounding (после успешного ai_insights в fallback). */
  groundingFailed?: boolean;
}> {
  const groundingPayload = row.grounding.map((g) => ({
    source_type: g.source_type,
    source_id: g.source_id,
    excerpt: g.excerpt,
  }));

  const { data: rpcId, error: rpcErr } = await supabase.rpc('insert_ai_insight_with_grounding', {
    p_farm_id: row.farm_id,
    p_cycle_id: row.cycle_id,
    p_scope_id: row.scope_id,
    p_insight_type: row.insight_type,
    p_title: row.title,
    p_body: row.body,
    p_user_query: row.user_query,
    p_facts_json: row.facts_json,
    p_interpretation_json: row.interpretation_json,
    p_recommendation_json: row.recommendation_json,
    p_hypotheses_json: row.hypotheses_json,
    p_confidence: row.confidence,
    p_confidence_label: row.confidence_label,
    p_missing_data_json: row.missing_data_json,
    p_trust_flags_json: row.trust_flags_json,
    p_model_name: row.model_name,
    p_created_by: row.created_by,
    p_grounding: groundingPayload,
  });

  if (!rpcErr && rpcId != null && rpcId !== '') {
    const id = typeof rpcId === 'string' ? rpcId : String(rpcId);
    return { insightId: id, error: null, usedRpc: true };
  }

  // Fallback: миграция ещё не применена или иная ошибка RPC
  const { data: inserted, error: insErr } = await supabase
    .from('ai_insights')
    .insert({
      farm_id: row.farm_id,
      cycle_id: row.cycle_id,
      scope_id: row.scope_id,
      insight_type: row.insight_type,
      title: row.title,
      body: row.body,
      user_query: row.user_query,
      facts_json: row.facts_json,
      interpretation_json: row.interpretation_json,
      recommendation_json: row.recommendation_json,
      hypotheses_json: row.hypotheses_json,
      confidence: row.confidence,
      confidence_label: row.confidence_label,
      missing_data_json: row.missing_data_json,
      trust_flags_json: row.trust_flags_json,
      model_name: row.model_name,
      created_by: row.created_by,
    })
    .select('id')
    .single();

  if (insErr || !inserted) {
    return {
      insightId: null,
      error: rpcErr?.message ?? insErr?.message ?? 'insert_failed',
      usedRpc: false,
    };
  }

  const insightId = inserted.id as string;

  const rows = row.grounding.map((g) => ({
    farm_id: row.farm_id,
    insight_id: insightId,
    source_type: g.source_type,
    source_id: g.source_id,
    excerpt: g.excerpt,
    weight: null as number | null,
  }));

  const { error: gErr } = await supabase.from('insight_grounding').insert(rows);
  if (gErr) {
    await supabase.from('ai_insights').delete().eq('id', insightId);
    return {
      insightId: null,
      error: gErr.message,
      usedRpc: false,
      groundingFailed: true,
    };
  }

  return { insightId, error: null, usedRpc: false };
}
