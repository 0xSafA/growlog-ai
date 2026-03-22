import type { IntentClassification, RetrievalIntentType } from '@/types/retrieval-assembly';

const CAUSAL =
  /\b(почему|зачем|из-за|причин|caus|why|because|trigger|вызвал|вызвало)\b/i;
const ACTION =
  /\b(что делать|как\s+(сейчас|лучше)|следующ(ий|его)|рекоменд|полей|подкорм|пролей|обреж|пересад|what\s+to\s+do|should\s+i)\b/i;
const STATUS =
  /\b(сейчас|текущ|состояни|как\s+дела|how\s+is|status|стадия\s+сейчас)\b/i;
const PLANNING =
  /\b(если\s+я|что\s+будет|план|когда\s+лучше|прогноз|timeline|schedule)\b/i;
const REPORT =
  /\b(отчёт|отчет|recap|summary\s+за|сводк|за\s+недел|за\s+месяц|grow\s+report)\b/i;
const EXPLORATION =
  /\b(покажи|найди|перечисл|список|сравни|поиск|where\s+is|list|show\s+me|find)\b/i;
const SOP =
  /\b(sop|регламент|протокол|чеклист|процедур)\b/i;
const DAILY =
  /\b(сегодня|на\s+сегодня|daily\s+focus|фокус\s+дня|просроч)\b/i;

const DIAG_HIGH =
  /\b(болезн|вредител|плесен|гриб|дефицит|токсич|загн|pests?|mold|deficienc|disease|вирус)\b/i;

/**
 * ADR-003 Stage 2 — deterministic MVP classifier (no LLM). Ties into SQL retrieval flags.
 */
export function classifyQueryIntent(queryText: string): IntentClassification {
  const q = queryText.trim();
  if (!q) {
    return {
      intentType: 'unknown',
      subIntents: [],
      diagnosticRiskLevel: 'low',
      requiresHistoricalContext: false,
      requiresKnowledgeContext: false,
      requiresSopContext: false,
      requiresPhotoContext: false,
      retrievalOnlyOutput: false,
    };
  }

  const scores: { intent: RetrievalIntentType; hit: boolean }[] = [
    { intent: 'daily_focus', hit: DAILY.test(q) },
    { intent: 'sop_execution_dialog', hit: SOP.test(q) },
    { intent: 'report', hit: REPORT.test(q) },
    { intent: 'exploration', hit: EXPLORATION.test(q) },
    { intent: 'planning', hit: PLANNING.test(q) },
    { intent: 'causal', hit: CAUSAL.test(q) },
    { intent: 'action', hit: ACTION.test(q) },
    { intent: 'status', hit: STATUS.test(q) },
  ];

  const hits = scores.filter((s) => s.hit).map((s) => s.intent);
  const primary: RetrievalIntentType = hits.length > 0 ? hits[0] : 'status';
  const subIntents = [...new Set(hits.slice(1))] as RetrievalIntentType[];

  const diagnosticRiskLevel: 'low' | 'medium' | 'high' = DIAG_HIGH.test(q)
    ? 'high'
    : primary === 'causal' || primary === 'action'
      ? 'medium'
      : 'low';

  const requiresHistoricalContext =
    primary === 'causal' || primary === 'planning' || subIntents.includes('planning');

  const requiresKnowledgeContext =
    primary === 'action' ||
    primary === 'planning' ||
    primary === 'causal' ||
    diagnosticRiskLevel === 'high';

  const requiresSopContext =
    primary === 'action' ||
    primary === 'daily_focus' ||
    primary === 'sop_execution_dialog' ||
    subIntents.includes('action');

  const requiresPhotoContext =
    primary === 'causal' ||
    primary === 'status' ||
    diagnosticRiskLevel === 'high';

  return {
    intentType: primary,
    subIntents,
    diagnosticRiskLevel,
    requiresHistoricalContext,
    requiresKnowledgeContext,
    requiresSopContext,
    requiresPhotoContext,
    retrievalOnlyOutput: false,
  };
}
