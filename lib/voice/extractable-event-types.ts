import type { EventType } from '@/types/domain';

/** Типы, которые допустимо выбрать из голоса (без системных / IoT). */
export const VOICE_EXTRACTABLE_EVENT_TYPES = [
  'note',
  'observation',
  'action_taken',
  'watering',
  'feeding',
  'pruning',
  'training',
  'transplant',
  'issue_detected',
  'pest_detected',
  'deficiency_suspected',
  'stage_changed',
  'harvest',
  'drying',
  'curing',
] as const satisfies readonly EventType[];

export type VoiceExtractableEventType = (typeof VOICE_EXTRACTABLE_EVENT_TYPES)[number];
