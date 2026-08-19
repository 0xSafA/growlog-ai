'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { PageHead } from '@/components/layout/PageHead';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { fetchSopRunById, SOP_RUNS_QUERY_KEY } from '@/lib/growlog/sop-queries';
import { executeSopRun } from '@/lib/growlog/sop-mutations';
import type { SopExecutionStatus } from '@/types/sop';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useMemo, useState } from 'react';

function SopRunInner({ runId }: { runId: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { supabase, farmId, cycle, primaryScope, userId } = useFarmContext();
  const [executionStatus, setExecutionStatus] = useState<SopExecutionStatus>('done');
  const [notes, setNotes] = useState('');
  const [measuredJson, setMeasuredJson] = useState('{}');
  const [evidenceJson, setEvidenceJson] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const statuses = useMemo(
    () =>
      [
        { value: 'done' as const, label: t('sop.statusDone') },
        { value: 'delayed' as const, label: t('sop.statusDelayed') },
        { value: 'partially_done' as const, label: t('sop.statusPartial') },
        { value: 'skipped' as const, label: t('sop.statusSkipped') },
        { value: 'blocked' as const, label: t('sop.statusBlocked') },
      ] satisfies { value: SopExecutionStatus; label: string }[],
    [t]
  );

  const runQuery = useQuery({
    queryKey: ['sop-run', runId],
    queryFn: () => fetchSopRunById(supabase, runId),
    enabled: !!runId,
  });

  const run = runQuery.data;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !cycle || !primaryScope || !run) return;
    setPending(true);
    setError(null);
    try {
      let measuredValues: Record<string, unknown> = {};
      let evidence: Record<string, unknown> = {};
      try {
        measuredValues = JSON.parse(measuredJson || '{}') as Record<string, unknown>;
        evidence = JSON.parse(evidenceJson || '{}') as Record<string, unknown>;
      } catch {
        setError(t('sop.invalidJson'));
        setPending(false);
        return;
      }
      await executeSopRun(supabase, {
        runId: run.id,
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        executionStatus,
        notes,
        userId,
        measuredValues,
        evidenceJson: evidence,
      });
      await queryClient.invalidateQueries({ queryKey: [SOP_RUNS_QUERY_KEY] });
      await router.push('/sop');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setPending(false);
    }
  }

  if (runQuery.isLoading) {
    return <p className="text-muted-foreground">{t('common.loading')}</p>;
  }

  if (!run) {
    return <p className="text-destructive">{t('sop.runNotFound')}</p>;
  }

  const defTitle =
    run.sop_definitions && typeof run.sop_definitions === 'object' && 'title' in run.sop_definitions
      ? (run.sop_definitions as { title: string }).title
      : 'SOP';

  const dueDescription =
    run.due_window_start && run.due_window_end
      ? t('sop.dueWindow', {
          start: new Date(run.due_window_start).toLocaleString(),
          end: new Date(run.due_window_end).toLocaleString(),
        })
      : run.due_at
        ? t('sop.dueAt', { date: new Date(run.due_at).toLocaleString() })
        : t('sop.noDue');

  if (!['open', 'acknowledged', 'overdue'].includes(run.status)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('sop.alreadyClosed')}</CardTitle>
          <CardDescription>
            {t('sop.status')} {run.status}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/sop">{t('sop.backToList')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{defTitle}</CardTitle>
        <CardDescription>
          {t('sop.executionDesc')} · {dueDescription}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('sop.executionStatusLabel')}</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={executionStatus}
              onChange={(e) => setExecutionStatus(e.target.value as SopExecutionStatus)}
            >
              {statuses.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('sop.notes')}</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('sop.notesPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('sop.measuredJsonLabel')}</label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              value={measuredJson}
              onChange={(e) => setMeasuredJson(e.target.value)}
              placeholder='{"runoff_ec": 1.2, "runoff_ph": 6.1}'
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('sop.evidenceJsonLabel')}</label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              value={evidenceJson}
              onChange={(e) => setEvidenceJson(e.target.value)}
              placeholder='{"evidence_photo": "media_asset_id"}'
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? t('common.saving') : t('sop.recordExecution')}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/sop">{t('common.cancel')}</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SopRunPageBody({ runId }: { runId: string }) {
  const { t } = useTranslation();
  return (
    <>
      <PageHead titleKey="titles.sopRun" />
      <AppShell title={t('titles.sopRun')}>
        {runId ? <SopRunInner runId={runId} /> : <p className="text-muted-foreground">{t('common.loading')}</p>}
      </AppShell>
    </>
  );
}

export default function SopRunPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';

  return (
    <AppRouteReady>
      <SopRunPageBody runId={id} />
    </AppRouteReady>
  );
}
