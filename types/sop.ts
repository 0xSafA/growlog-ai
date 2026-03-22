export type SopTriggerType =
  | 'date_based'
  | 'time_based'
  | 'stage_based'
  | 'offset_based'
  | 'event_based'
  | 'recurring_daily'
  | 'recurring_interval'
  | 'condition_based'
  | 'location_based'
  | 'manual';

export type SopRunStatus =
  | 'open'
  | 'acknowledged'
  | 'completed'
  | 'skipped'
  | 'overdue'
  | 'blocked'
  | 'cancelled';

export type SopExecutionStatus = 'done' | 'skipped' | 'delayed' | 'blocked' | 'partially_done';

export type SopDefinitionRow = {
  id: string;
  farm_id: string;
  title: string;
  description: string | null;
  active: boolean;
  applies_to_scope: string;
  instructions_json: Record<string, unknown>;
  /** String keys, e.g. `runoff_ec`, `evidence_photo` (see data-platform spec). */
  required_inputs_after_execution: unknown;
  severity_if_missed: string;
};

export type SopTriggerRow = {
  id: string;
  farm_id: string;
  sop_definition_id: string;
  trigger_type: SopTriggerType;
  trigger_config: Record<string, unknown>;
  active: boolean;
};

export type SopAssignmentRow = {
  id: string;
  farm_id: string;
  sop_definition_id: string;
  cycle_id: string | null;
  scope_id: string | null;
  assignment_status: string;
};

export type SopRunRow = {
  id: string;
  farm_id: string;
  sop_definition_id: string;
  trigger_id: string | null;
  assignment_id: string | null;
  cycle_id: string | null;
  scope_id: string | null;
  anchor_date: string | null;
  due_at: string | null;
  due_window_start?: string | null;
  due_window_end?: string | null;
  status: SopRunStatus;
  priority: string;
  reason_text: string | null;
  trigger_snapshot: Record<string, unknown>;
  source_event_id?: string | null;
  sop_definitions?: {
    title: string;
    description: string | null;
    required_inputs_after_execution?: unknown;
  };
};
