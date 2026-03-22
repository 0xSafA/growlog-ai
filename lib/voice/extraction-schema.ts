import type { VoiceExtractableEventType } from '@/lib/voice/extractable-event-types';
import { VOICE_EXTRACTABLE_EVENT_TYPES } from '@/lib/voice/extractable-event-types';

export type VoiceExtractionResult = {
  event_type: VoiceExtractableEventType;
  body: string;
  title: string | null;
  /** ISO 8601 или null — тогда используем время подтверждения */
  occurred_at_iso: string | null;
};

const allowed = new Set<string>(VOICE_EXTRACTABLE_EVENT_TYPES);

export function parseVoiceExtractionJson(raw: string): VoiceExtractionResult {
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
  const event_type = o.event_type;
  const body = o.body;
  if (typeof event_type !== 'string' || !allowed.has(event_type)) {
    throw new Error('Недопустимый event_type в ответе модели');
  }
  if (typeof body !== 'string' || !body.trim()) {
    throw new Error('Пустой body в ответе модели');
  }
  const title = o.title === null || o.title === undefined ? null : String(o.title);
  const occurred =
    o.occurred_at_iso === null || o.occurred_at_iso === undefined
      ? null
      : String(o.occurred_at_iso);

  if (occurred) {
    const d = Date.parse(occurred);
    if (Number.isNaN(d)) {
      throw new Error('Некорректный occurred_at_iso');
    }
  }

  return {
    event_type: event_type as VoiceExtractableEventType,
    body: body.trim(),
    title: title?.trim() ? title.trim() : null,
    occurred_at_iso: occurred,
  };
}
