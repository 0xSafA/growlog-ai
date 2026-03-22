'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { fetchSopRunById, SOP_RUNS_QUERY_KEY } from '@/lib/growlog/sop-queries';
import { executeSopRun } from '@/lib/growlog/sop-mutations';
import type { SopExecutionStatus } from '@/types/sop';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

const STATUSES: { value: SopExecutionStatus; label: string }[] = [
  { value: 'done', label: 'Выполнено' },
  { value: 'delayed', label: 'Отложено' },
  { value: 'partially_done', label: 'Частично' },
  { value: 'skipped', label: 'Пропуск' },
  { value: 'blocked', label: 'Блокер' },
];

function SopRunInner({ runId }: { runId: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { supabase, farmId, cycle, primaryScope, userId } = useFarmContext();
  const [executionStatus, setExecutionStatus] = useState<SopExecutionStatus>('done');
  const [notes, setNotes] = useState('');
  const [measuredJson, setMeasuredJson] = useState('{}');
  const [evidenceJson, setEvidenceJson] = useState('{}');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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
        setError('Некорректный JSON в полях замеров / evidence');
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
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setPending(false);
    }
  }

  if (runQuery.isLoading) {
    return <p className="text-muted-foreground">Загрузка…</p>;
  }

  if (!run) {
    return <p className="text-destructive">Задача не найдена.</p>;
  }

  const defTitle =
    run.sop_definitions && typeof run.sop_definitions === 'object' && 'title' in run.sop_definitions
      ? (run.sop_definitions as { title: string }).title
      : 'SOP';

  if (!['open', 'acknowledged', 'overdue'].includes(run.status)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Уже закрыто</CardTitle>
          <CardDescription>Статус: {run.status}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/sop">К списку</Link>
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
          Исполнение SOP run ·{' '}
          {run.due_window_start && run.due_window_end
            ? `окно ${new Date(run.due_window_start).toLocaleString()} — ${new Date(run.due_window_end).toLocaleString()}`
            : run.due_at
              ? `срок ${new Date(run.due_at).toLocaleString()}`
              : 'срок не задан'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Статус исполнения</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={executionStatus}
              onChange={(e) => setExecutionStatus(e.target.value as SopExecutionStatus)}
            >
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Заметки</label>
            <textarea
              className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Факты, замеры, что сделали"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Замеры (JSON, ключи из required_inputs)</label>
            <textarea
              className="flex min-h-[72px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
              value={measuredJson}
              onChange={(e) => setMeasuredJson(e.target.value)}
              placeholder='{"runoff_ec": 1.2, "runoff_ph": 6.1}'
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Evidence (JSON, фото и т.п.)</label>
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
              {pending ? 'Сохранение…' : 'Зафиксировать'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/sop">Отмена</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SopRunPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : '';

  return (
    <>
      <Head>
        <title>Исполнение SOP — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Исполнение SOP">
          {id ? <SopRunInner runId={id} /> : <p className="text-muted-foreground">…</p>}
        </AppShell>
      </AppRouteReady>
    </>
  );
}
