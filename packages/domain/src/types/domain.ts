/** Canonical event types (ADR-001) */
export const EVENT_TYPES = [
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
  'sensor_snapshot',
  'photo_capture',
  'sop_due',
  'sop_executed',
  'sop_missed',
  'ai_analysis',
  'anomaly',
  'report_generated',
  'conversation_turn',
  'external_sync',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

export const SOURCE_TYPES = [
  'user_text',
  'user_voice',
  'user_form',
  'sensor_api',
  'file_upload',
  'internal_system',
  'ai_generated',
  'imported',
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

export type GrowCycleStatus =
  | 'planned'
  | 'active'
  | 'harvested'
  | 'archived'
  | 'cancelled';

export type GrowStage =
  | 'propagation'
  | 'veg'
  | 'flower'
  | 'drying'
  | 'curing'
  | 'completed';

export type ScopeType =
  | 'farm'
  | 'site'
  | 'room'
  | 'tent'
  | 'zone'
  | 'bed'
  | 'reservoir'
  | 'plant_group'
  | 'plant';
