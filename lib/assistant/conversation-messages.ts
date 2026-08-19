import type { SupabaseClient } from '@supabase/supabase-js';

export async function persistConversationTurn(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    conversationId: string;
    cycleId: string | null;
    scopeId: string | null;
    userId: string;
    userMessage: string;
    assistantMessage: string;
    insightId?: string | null;
  }
) {
  const base = {
    farm_id: params.farmId,
    conversation_id: params.conversationId,
    cycle_id: params.cycleId,
    scope_id: params.scopeId,
    modality: 'text' as const,
  };

  const { error: uErr } = await supabase.from('conversation_messages').insert({
    ...base,
    role: 'user',
    message_text: params.userMessage.slice(0, 8000),
    grounding_json: { user_id: params.userId },
  });
  if (uErr) {
    if (
      uErr.code === '42703' ||
      uErr.code === 'PGRST204' ||
      /conversation_id/i.test(uErr.message ?? '')
    ) {
      return;
    }
    throw uErr;
  }

  const { error: aErr } = await supabase.from('conversation_messages').insert({
    ...base,
    role: 'assistant',
    message_text: params.assistantMessage.slice(0, 8000),
    grounding_json: params.insightId ? { insight_id: params.insightId } : {},
  });
  if (aErr) {
    if (
      aErr.code === '42703' ||
      aErr.code === 'PGRST204' ||
      /conversation_id/i.test(aErr.message ?? '')
    ) {
      return;
    }
    throw aErr;
  }
}
