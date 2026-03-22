import type { ResolvedQueryScope, RetrievalIntentType, TimeWindowIso } from '@/types/retrieval-assembly';

const DEFAULT_WINDOW_HOURS = 72;
const REPORT_WINDOW_DAYS = 30;
const CAUSAL_WINDOW_DAYS = 7;
const PLANNING_WINDOW_DAYS = 14;
/** Защита от слишком широких запросов в MVP (клиентский `requested_time_window`). */
const MAX_REQUESTED_RANGE_MS = 366 * 24 * 60 * 60 * 1000;

export function defaultOperationalWindow(to: Date): TimeWindowIso {
  const from = new Date(to.getTime() - DEFAULT_WINDOW_HOURS * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function timeWindowForIntent(
  intent: RetrievalIntentType,
  now: Date
): TimeWindowIso {
  const to = now;
  let from: Date;
  switch (intent) {
    case 'report':
      from = new Date(to.getTime() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      break;
    case 'causal':
      from = new Date(to.getTime() - CAUSAL_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      break;
    case 'planning':
      from = new Date(to.getTime() - PLANNING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      break;
    case 'exploration':
      from = new Date(to.getTime() - REPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
      break;
    default:
      return defaultOperationalWindow(to);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export type ParsedRequestedWindow =
  | { ok: true; window: TimeWindowIso }
  | { ok: false; error: string };

/**
 * Разбор `requested_time_window` с тела API (ADR-003). Невалидное значение → не подменяем окно intent.
 */
export function parseRequestedTimeWindow(raw: unknown): ParsedRequestedWindow {
  if (raw === null || raw === undefined) {
    return { ok: false, error: 'missing' };
  }
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'not_object' };
  }
  const o = raw as Record<string, unknown>;
  const fromIn = typeof o.from === 'string' ? o.from.trim() : '';
  const toIn = typeof o.to === 'string' ? o.to.trim() : '';
  if (!fromIn || !toIn) {
    return { ok: false, error: 'missing_from_or_to' };
  }
  const a = Date.parse(fromIn);
  const b = Date.parse(toIn);
  if (Number.isNaN(a) || Number.isNaN(b)) {
    return { ok: false, error: 'invalid_iso_date' };
  }
  if (a >= b) {
    return { ok: false, error: 'from_must_be_before_to' };
  }
  if (b - a > MAX_REQUESTED_RANGE_MS) {
    return { ok: false, error: 'range_exceeds_max_days' };
  }
  return {
    ok: true,
    window: { from: new Date(a).toISOString(), to: new Date(b).toISOString() },
  };
}

/**
 * ADR-003 Stage 1 — deterministic scope from UI / API. Ambiguous natural-language scope → future: clarify.
 */
export function resolveQueryScope(params: {
  farmId: string;
  cycleId: string | null;
  scopeId: string | null;
  now?: Date;
  intentType?: RetrievalIntentType;
}): ResolvedQueryScope {
  const now = params.now ?? new Date();
  const intent = params.intentType ?? 'unknown';
  const timeWindow = timeWindowForIntent(intent, now);

  return {
    farmId: params.farmId,
    cycleId: params.cycleId,
    scopeId: params.scopeId,
    timeWindow,
    timeWindowSource: 'intent',
    needsClarification: false,
    clarificationHint: null,
  };
}

/**
 * Если клиент передал валидное окно — подменяет `time_window` и помечает `timeWindowSource: requested`.
 */
export function applyRequestedTimeWindow(
  resolved: ResolvedQueryScope,
  requested: TimeWindowIso | null
): ResolvedQueryScope {
  if (!requested) {
    return resolved;
  }
  return {
    ...resolved,
    timeWindow: requested,
    timeWindowSource: 'requested',
  };
}
