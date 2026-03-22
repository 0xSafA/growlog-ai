import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { getBearerToken, getUserFromBearer } from '@/lib/api/auth-from-request';
import { ASSISTANT_SYSTEM } from '@/lib/assistant/prompts';
import {
  parseAssistantModelJson,
  type AssistantModelResponse,
} from '@/lib/assistant/response-schema';
import { applyTrustLayer } from '@/lib/assistant/trust-layer';
import {
  buildEmptyRetrievalResponse,
  buildScopeClarificationResponse,
  isRetrievalEmptyForAdvice,
} from '@/lib/assistant/deterministic-insight';
import { insertInsightWithGrounding } from '@/lib/assistant/persist-insight';
import {
  assembleAnswerContext,
  formatRetrievalContextForPrompt,
} from '@/lib/growlog/assemble-retrieval-context';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const MODEL = 'gpt-4o-mini';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authError } = await getUserFromBearer(req);
  if (!user || authError) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const body = req.body as {
    message?: string;
    farmId?: string;
    cycleId?: string | null;
    scopeId?: string | null;
    conversationId?: string | null;
    requestedTimeWindow?: { from?: string; to?: string } | null;
  };

  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message) {
    return res.status(400).json({ error: 'missing_message' });
  }
  if (!body.farmId || typeof body.farmId !== 'string') {
    return res.status(400).json({ error: 'missing_farm_id' });
  }

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const cycleId =
    body.cycleId === null || body.cycleId === undefined || body.cycleId === ''
      ? null
      : body.cycleId;
  const scopeId =
    body.scopeId === null || body.scopeId === undefined || body.scopeId === ''
      ? null
      : body.scopeId;

  const conversationId =
    body.conversationId === null ||
    body.conversationId === undefined ||
    body.conversationId === ''
      ? null
      : body.conversationId;

  const requestedTimeWindow =
    body.requestedTimeWindow === null || body.requestedTimeWindow === undefined
      ? undefined
      : body.requestedTimeWindow;

  let pack;
  try {
    pack = await assembleAnswerContext(supabase, {
      farmId: body.farmId,
      userId: user.id,
      queryText: message,
      cycleId,
      scopeId,
      conversationId,
      requestedTimeWindow,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'retrieval_failed';
    return res.status(500).json({ error: 'retrieval_failed', detail: msg });
  }

  const skipLlm =
    pack.scope.needsClarification || isRetrievalEmptyForAdvice(pack);

  if (!skipLlm && !process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'openai_not_configured' });
  }

  let parsed: AssistantModelResponse;
  let modelUsed: string;

  if (pack.scope.needsClarification) {
    parsed = buildScopeClarificationResponse(pack, message);
    modelUsed = 'deterministic_scope_clarification';
  } else if (isRetrievalEmptyForAdvice(pack)) {
    parsed = buildEmptyRetrievalResponse(pack);
    modelUsed = 'deterministic_empty_context';
  } else {
    const contextBlock = formatRetrievalContextForPrompt(pack);
    const userContent = `Контекст фермы:\n${contextBlock}\n\n---\nВопрос пользователя:\n${message}`;

    let raw: string;
    try {
      const completion = await openai.chat.completions.create({
        model: MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: ASSISTANT_SYSTEM },
          { role: 'user', content: userContent },
        ],
      });
      raw = completion.choices[0]?.message?.content ?? '';
      if (!raw) {
        return res.status(502).json({ error: 'empty_model_response' });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'model_failed';
      return res.status(502).json({ error: 'model_failed', detail: msg });
    }

    try {
      parsed = parseAssistantModelJson(raw);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'parse_failed';
      return res.status(422).json({ error: 'invalid_model_json', detail: msg });
    }
    modelUsed = MODEL;
  }

  const trust = applyTrustLayer(parsed, pack);
  const out = trust.response;

  const interpretationJson =
    out.interpretation && out.interpretation.trim()
      ? { text: out.interpretation.trim() }
      : {};
  const recommendationJson =
    out.recommendation && out.recommendation.trim()
      ? { text: out.recommendation.trim() }
      : {};

  if (!trust.persistInsight) {
    return res.status(200).json({
      insightId: null,
      persisted: false,
      persistenceReason: trust.persistenceReason,
      model: modelUsed,
      retrievalPath: skipLlm ? 'deterministic' : 'llm',
      ...out,
    });
  }

  const insertResult = await insertInsightWithGrounding(supabase, {
    farm_id: body.farmId,
    cycle_id: cycleId,
    scope_id: scopeId,
    insight_type: out.insight_type,
    title: out.title,
    body: out.body,
    user_query: message,
    facts_json: out.facts,
    interpretation_json: interpretationJson,
    recommendation_json: recommendationJson,
    hypotheses_json: out.hypotheses,
    confidence: out.confidence.score,
    confidence_label: out.confidence.label,
    missing_data_json: out.missing_data,
    trust_flags_json: out.trust_flags,
    model_name: modelUsed,
    created_by: user.id,
    grounding: out.grounding,
  });

  if (insertResult.error || !insertResult.insightId) {
    return res.status(200).json({
      insightId: null,
      persisted: false,
      persistenceReason: insertResult.groundingFailed
        ? ('grounding_attach_failed' as const)
        : ('persist_insert_failed' as const),
      persistDetail: insertResult.error ?? 'insert',
      model: modelUsed,
      retrievalPath: skipLlm ? 'deterministic' : 'llm',
      persistRpc: insertResult.usedRpc,
      ...out,
    });
  }

  return res.status(200).json({
    insightId: insertResult.insightId,
    persisted: true as const,
    persistenceReason: trust.persistenceReason,
    model: modelUsed,
    retrievalPath: skipLlm ? 'deterministic' : 'llm',
    persistRpc: insertResult.usedRpc,
    groundingPersisted: out.grounding.length > 0,
    ...out,
  });
}
