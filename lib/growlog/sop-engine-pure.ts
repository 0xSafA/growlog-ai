/**
 * Pure SOP engine helpers (ADR-006) — safe for client bundles; no DB / timezone I/O.
 */
import type { SopRunRow, SopRunStatus } from '@/types/sop';

export type SopRunPriorityDb = 'low' | 'normal' | 'high' | 'urgent';

/** Overdue is evaluated against end of window when present (ADR-006). */
export function effectiveDueBoundaryIso(run: {
  due_at: string | null;
  due_window_end?: string | null;
}): string | null {
  return run.due_window_end ?? run.due_at ?? null;
}

export function isRunPastDue(now: Date, run: { due_at: string | null; due_window_end?: string | null }): boolean {
  const b = effectiveDueBoundaryIso(run);
  if (!b) return false;
  return new Date(b).getTime() < now.getTime();
}

/** ADR-006 transitions; overdue → acknowledged supports “отложено” without закрытия run. */
export function canTransitionSopRun(from: SopRunStatus, to: SopRunStatus): boolean {
  const allowed: Record<SopRunStatus, SopRunStatus[]> = {
    open: ['acknowledged', 'completed', 'skipped', 'blocked', 'overdue', 'cancelled'],
    acknowledged: ['completed', 'blocked', 'skipped', 'overdue', 'cancelled'],
    overdue: ['completed', 'blocked', 'skipped', 'acknowledged'],
    completed: [],
    skipped: [],
    blocked: [],
    cancelled: [],
  };
  return allowed[from]?.includes(to) ?? false;
}

export function computeRunPriority(params: {
  criticality: string;
  severity_if_missed: string;
  isOverdue: boolean;
}): SopRunPriorityDb {
  const { criticality, severity_if_missed, isOverdue } = params;
  const sev =
    criticality === 'critical' || severity_if_missed === 'critical'
      ? 4
      : criticality === 'high' || severity_if_missed === 'high'
        ? 3
        : criticality === 'low' && severity_if_missed === 'low'
          ? 1
          : 2;
  let p: SopRunPriorityDb =
    sev >= 4 ? 'urgent' : sev === 3 ? 'high' : sev === 1 ? 'low' : 'normal';
  if (isOverdue && p === 'normal') p = 'high';
  if (isOverdue && p === 'low') p = 'normal';
  return p;
}

const PRIORITY_RANK: Record<SopRunPriorityDb, number> = {
  urgent: 4,
  high: 3,
  normal: 2,
  low: 1,
};

/** Higher = earlier in Daily Focus (ADR-006 ordering). */
function dailyFocusPrimaryScore(r: SopRunRow): number {
  const pr =
    (r.priority as SopRunPriorityDb) in PRIORITY_RANK ? (r.priority as SopRunPriorityDb) : 'normal';
  const rank = PRIORITY_RANK[pr];
  const overdue = r.status === 'overdue';
  const ack = r.status === 'acknowledged';
  let s = 0;
  if (overdue) s += 1_000_000;
  s += rank * 10_000;
  if (!overdue && ack) s += 1_000;
  if (!overdue && !ack) s += 100;
  return s;
}

/** Daily Focus ordering (ADR-006): просрочка и приоритет выше; затем ближайший дедлайн. */
export function sortSopRunsForDailyFocus(runs: SopRunRow[]): SopRunRow[] {
  return [...runs].sort((a, b) => {
    const pa = dailyFocusPrimaryScore(a);
    const pb = dailyFocusPrimaryScore(b);
    if (pb !== pa) return pb - pa;
    const ta = effectiveDueBoundaryIso(a);
    const tb = effectiveDueBoundaryIso(b);
    if (!ta && !tb) return 0;
    if (!ta) return 1;
    if (!tb) return -1;
    return new Date(ta).getTime() - new Date(tb).getTime();
  });
}

export function normalizeLocalTime(s: string): string {
  const t = s.trim();
  if (/^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':');
    return `${h!.padStart(2, '0')}:${m!.padStart(2, '0')}:00`;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(t)) {
    const [h, m, sec] = t.split(':');
    return `${h!.padStart(2, '0')}:${m!.padStart(2, '0')}:${sec!.padStart(2, '0')}`;
  }
  return '09:00:00';
}
