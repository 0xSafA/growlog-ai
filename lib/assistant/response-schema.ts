export type GroundingItemParsed = {
  source_type: string;
  source_id: string | null;
  excerpt: string | null;
};

export type AssistantModelResponse = {
  insight_type: string;
  title: string | null;
  body: string;
  facts: string[];
  interpretation: string | null;
  hypotheses: string[];
  recommendation: string | null;
  confidence: { score: number; label: 'low' | 'medium' | 'high' };
  missing_data: string[];
  grounding: GroundingItemParsed[];
  trust_flags: string[];
};

const ALLOWED_INSIGHT = new Set([
  'summary',
  'recommendation',
  'causal_explanation',
  'clarification_request',
  'evidence_summary',
  'pattern',
  'risk',
  'daily_focus',
  'anomaly',
  'story_block',
  'other',
]);

const GROUNDING_SOURCE = new Set([
  'event',
  'observation',
  'sensor_reading',
  'sop_run',
  'sop_definition',
  'media_asset',
  'grow_cycle',
  'scope',
]);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function parseAssistantModelJson(raw: string): AssistantModelResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Некорректный JSON от модели');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Пустой ответ модели');
  }
  const o = parsed as Record<string, unknown>;

  const insight_type =
    typeof o.insight_type === 'string' && ALLOWED_INSIGHT.has(o.insight_type)
      ? o.insight_type
      : 'other';

  const body = typeof o.body === 'string' && o.body.trim() ? o.body.trim() : null;
  if (!body) {
    throw new Error('Пустой body в ответе модели');
  }

  const title =
    o.title === null || o.title === undefined
      ? null
      : typeof o.title === 'string' && o.title.trim()
        ? o.title.trim()
        : null;

  const facts = Array.isArray(o.facts)
    ? o.facts
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
    : [];

  const interpretation =
    o.interpretation === null || o.interpretation === undefined
      ? null
      : typeof o.interpretation === 'string' && o.interpretation.trim()
        ? o.interpretation.trim()
        : null;

  const hypotheses = Array.isArray(o.hypotheses)
    ? o.hypotheses
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
    : [];

  const recommendation =
    o.recommendation === null || o.recommendation === undefined
      ? null
      : typeof o.recommendation === 'string' && o.recommendation.trim()
        ? o.recommendation.trim()
        : null;

  const conf = o.confidence;
  let score = 0.5;
  let label: 'low' | 'medium' | 'high' = 'medium';
  if (conf && typeof conf === 'object' && !Array.isArray(conf)) {
    const c = conf as Record<string, unknown>;
    if (typeof c.score === 'number' && !Number.isNaN(c.score)) {
      score = Math.min(1, Math.max(0, c.score));
    }
    if (c.label === 'low' || c.label === 'medium' || c.label === 'high') {
      label = c.label;
    }
  }

  const missing_data = Array.isArray(o.missing_data)
    ? o.missing_data
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
    : [];

  const groundingRaw = Array.isArray(o.grounding) ? o.grounding : [];
  const grounding: GroundingItemParsed[] = [];
  for (const g of groundingRaw) {
    if (!g || typeof g !== 'object') continue;
    const gr = g as Record<string, unknown>;
    const source_type =
      typeof gr.source_type === 'string' && GROUNDING_SOURCE.has(gr.source_type)
        ? gr.source_type
        : null;
    if (!source_type) continue;
    let source_id: string | null = null;
    if (typeof gr.source_id === 'string' && isUuid(gr.source_id)) {
      source_id = gr.source_id;
    }
    const excerpt =
      typeof gr.excerpt === 'string' && gr.excerpt.trim() ? gr.excerpt.trim() : null;
    grounding.push({ source_type, source_id, excerpt });
  }

  const trust_flags = Array.isArray(o.trust_flags)
    ? o.trust_flags
        .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
        .map((s) => s.trim())
    : [];

  return {
    insight_type,
    title,
    body,
    facts,
    interpretation,
    hypotheses,
    recommendation,
    confidence: { score, label },
    missing_data,
    grounding,
    trust_flags,
  };
}
