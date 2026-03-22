import type { SupabaseClient } from '@supabase/supabase-js';
import type { SopExecutionStatus, SopRunStatus } from '@/types/sop';
import type { EventType } from '@/types/domain';
import { canTransitionSopRun } from '@/lib/growlog/sop-engine-pure';
import { missingRequiredInputs, parseRequiredInputKeys } from '@/lib/growlog/sop-required-inputs';

export async function createSopDefinitionWithAssignment(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string;
    scopeId: string;
    title: string;
    description: string;
    localTime: string;
    appliesToScope: string;
  }
) {
  const { farmId, cycleId, scopeId, title, description, localTime, appliesToScope } = params;

  const { data: def, error: dErr } = await supabase
    .from('sop_definitions')
    .insert({
      farm_id: farmId,
      title: title.trim(),
      description: description.trim() || null,
      applies_to_scope: appliesToScope,
      instructions_json: {},
      required_inputs_after_execution: [],
    })
    .select()
    .single();
  if (dErr) throw dErr;

  const { data: tr, error: tErr } = await supabase
    .from('sop_triggers')
    .insert({
      farm_id: farmId,
      sop_definition_id: def.id,
      trigger_type: 'recurring_daily',
      trigger_config: { local_time: localTime },
      active: true,
    })
    .select()
    .single();
  if (tErr) throw tErr;

  const { data: asn, error: aErr } = await supabase
    .from('sop_assignments')
    .insert({
      farm_id: farmId,
      sop_definition_id: def.id,
      cycle_id: cycleId,
      scope_id: scopeId,
      assignment_status: 'active',
    })
    .select()
    .single();
  if (aErr) throw aErr;

  return { definition: def, trigger: tr, assignment: asn };
}

function eventTypeForExecution(status: SopExecutionStatus): EventType {
  if (status === 'skipped' || status === 'blocked') return 'sop_missed';
  return 'sop_executed';
}

function nextRunStatusAfterExecution(
  current: SopRunStatus,
  executionStatus: SopExecutionStatus,
  opts?: { partialIncomplete?: boolean }
): SopRunStatus {
  if (executionStatus === 'done') return 'completed';
  if (executionStatus === 'partially_done') {
    return opts?.partialIncomplete ? 'acknowledged' : 'completed';
  }
  if (executionStatus === 'delayed') return 'acknowledged';
  if (executionStatus === 'skipped') return 'skipped';
  if (executionStatus === 'blocked') return 'blocked';
  return current;
}

export async function executeSopRun(
  supabase: SupabaseClient,
  params: {
    runId: string;
    farmId: string;
    cycleId: string;
    scopeId: string;
    executionStatus: SopExecutionStatus;
    notes: string;
    userId: string | null;
    measuredValues?: Record<string, unknown>;
    evidenceJson?: Record<string, unknown>;
  }
) {
  const { runId, farmId, cycleId, scopeId, executionStatus, notes, userId } = params;
  const measuredValues = params.measuredValues ?? {};
  const evidenceJson = params.evidenceJson ?? {};

  const { data: run, error: runErr } = await supabase
    .from('sop_runs')
    .select('id, status, sop_definition_id, farm_id')
    .eq('id', runId)
    .eq('farm_id', farmId)
    .maybeSingle();
  if (runErr) throw runErr;
  if (!run) {
    throw new Error('Задача не найдена');
  }
  if (!['open', 'acknowledged', 'overdue'].includes(run.status)) {
    throw new Error('Этот SOP run уже закрыт');
  }

  const { data: def, error: defErr } = await supabase
    .from('sop_definitions')
    .select('required_inputs_after_execution')
    .eq('id', run.sop_definition_id)
    .single();
  if (defErr) throw defErr;

  const required = parseRequiredInputKeys(def?.required_inputs_after_execution);
  const miss =
    executionStatus === 'done' || executionStatus === 'partially_done'
      ? missingRequiredInputs(required, measuredValues, evidenceJson)
      : [];

  if (executionStatus === 'done' && miss.length > 0) {
    throw new Error(`Недостаточно обязательных полей: ${miss.join(', ')}`);
  }

  const partialIncomplete =
    executionStatus === 'partially_done' && required.length > 0 && miss.length > 0;

  const currentStatus = run.status as SopRunStatus;
  const nextStatus = nextRunStatusAfterExecution(currentStatus, executionStatus, { partialIncomplete });
  const delayedRepeat =
    executionStatus === 'delayed' && nextStatus === currentStatus && currentStatus === 'acknowledged';
  const partialStayAck =
    executionStatus === 'partially_done' &&
    nextStatus === currentStatus &&
    currentStatus === 'acknowledged' &&
    partialIncomplete;
  if (!delayedRepeat && !partialStayAck && !canTransitionSopRun(currentStatus, nextStatus)) {
    throw new Error('Недопустимый переход статуса SOP run');
  }

  const eventType = eventTypeForExecution(executionStatus);
  const body =
    notes.trim() ||
    `SOP: ${executionStatus.replace(/_/g, ' ')}`;

  const { data: ev, error: eErr } = await supabase
    .from('events')
    .insert({
      farm_id: farmId,
      cycle_id: cycleId,
      scope_id: scopeId,
      event_type: eventType,
      body,
      occurred_at: new Date().toISOString(),
      source_type: 'user_form',
      payload: {
        sop_run_id: runId,
        sop_definition_id: run.sop_definition_id,
        execution_status: executionStatus,
      },
      created_by: userId ?? null,
    })
    .select()
    .single();
  if (eErr) throw eErr;

  const { error: exErr } = await supabase.from('sop_executions').insert({
    farm_id: farmId,
    sop_run_id: runId,
    event_id: ev.id,
    scope_id: scopeId,
    executed_by: userId ?? null,
    execution_status: executionStatus,
    intent_status: executionStatus === 'delayed' ? 'will_do' : null,
    notes: notes.trim() || null,
    measured_values: measuredValues,
    evidence_json: evidenceJson,
    result_json: {},
  });
  if (exErr) throw exErr;

  const { error: uErr } = await supabase
    .from('sop_runs')
    .update({
      status: nextStatus,
      related_event_id: ev.id,
    })
    .eq('id', runId);
  if (uErr) throw uErr;

  return { event: ev };
}

export async function acknowledgeSopRun(
  supabase: SupabaseClient,
  params: { runId: string; farmId: string; cycleId: string; scopeId: string; userId: string | null }
) {
  const { data: run, error: runErr } = await supabase
    .from('sop_runs')
    .select('id, status, sop_definition_id')
    .eq('id', params.runId)
    .eq('farm_id', params.farmId)
    .maybeSingle();
  if (runErr) throw runErr;
  if (!run) {
    throw new Error('Задача не найдена');
  }
  const current = run.status as SopRunStatus;
  if (!canTransitionSopRun(current, 'acknowledged')) {
    throw new Error('Подтверждение недоступно для этого статуса');
  }

  const { error: eErr } = await supabase.from('events').insert({
    farm_id: params.farmId,
    cycle_id: params.cycleId,
    scope_id: params.scopeId,
    event_type: 'note',
    body: 'SOP: подтверждено к исполнению',
    occurred_at: new Date().toISOString(),
    source_type: 'user_form',
    payload: {
      sop_run_id: params.runId,
      sop_definition_id: run.sop_definition_id,
      kind: 'sop_acknowledgement',
    },
    created_by: params.userId,
  });
  if (eErr) throw eErr;

  const { error: uErr } = await supabase
    .from('sop_runs')
    .update({ status: 'acknowledged' })
    .eq('id', params.runId);
  if (uErr) throw uErr;
}
