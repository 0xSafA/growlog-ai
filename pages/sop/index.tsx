'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { fetchOpenSopRuns, fetchSopDefinitions, SOP_RUNS_QUERY_KEY } from '@/lib/growlog/sop-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInTimeZone } from 'date-fns-tz';
import { useQuery } from '@tanstack/react-query';
import Head from 'next/head';
import Link from 'next/link';
import { Plus } from 'lucide-react';

function SopIndexInner() {
  const { supabase, farmId, cycle, farms } = useFarmContext();
  const farm = farms.find((f) => f.id === farmId);

  const defsQuery = useQuery({
    queryKey: ['sop-definitions', farmId],
    enabled: !!farmId,
    queryFn: () => fetchSopDefinitions(supabase, farmId!),
  });

  const runsQuery = useQuery({
    queryKey: [SOP_RUNS_QUERY_KEY, farmId, cycle?.id],
    enabled: !!farmId && !!cycle?.id && !!farm,
    queryFn: async () => {
      const anchorDate = formatInTimeZone(
        new Date(),
        farm?.timezone ?? 'UTC',
        'yyyy-MM-dd'
      );
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Нет сессии');
      const m = await fetch('/api/sop/materialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          farmId,
          cycleId: cycle!.id,
          anchorDate,
        }),
      });
      if (!m.ok) {
        const j = (await m.json()) as { error?: string };
        throw new Error(j.error ?? 'materialize_failed');
      }
      return fetchOpenSopRuns(supabase, { farmId: farmId!, cycleId: cycle!.id });
    },
  });

  if (!cycle) {
    return <p className="text-muted-foreground">Нужен активный цикл.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Фаза 3 ADR-001: регламенты, ежедневные run, исполнение.
        </p>
        <Button asChild size="sm">
          <Link href="/sop/new">
            <Plus className="mr-2 h-4 w-4" />
            Новый SOP
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Активные задачи (run)</CardTitle>
          <CardDescription>Открытые и просроченные по текущему циклу.</CardDescription>
        </CardHeader>
        <CardContent>
          {runsQuery.isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
          {runsQuery.error && (
            <p className="text-sm text-destructive">
              {(runsQuery.error as Error).message}
            </p>
          )}
          {runsQuery.data && runsQuery.data.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Нет открытых SOP. Создайте регламент с ежедневным триггером или обновите страницу завтра.
            </p>
          )}
          <ul className="space-y-2">
            {runsQuery.data?.map((r) => {
              const title =
                r.sop_definitions && typeof r.sop_definitions === 'object' && 'title' in r.sop_definitions
                  ? (r.sop_definitions as { title: string }).title
                  : 'SOP';
              return (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/80 px-3 py-2"
                >
                  <div>
                    <p className="font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.status}
                      {r.due_at &&
                        ` · до ${new Date(r.due_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })}`}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="secondary">
                    <Link href={`/sop/run/${r.id}`}>Исполнить</Link>
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Регламенты</CardTitle>
          <CardDescription>Активные определения SOP на ферме.</CardDescription>
        </CardHeader>
        <CardContent>
          {defsQuery.isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
          <ul className="space-y-2">
            {defsQuery.data?.map((d) => (
              <li key={d.id} className="text-sm">
                <span className="font-medium">{d.title}</span>
                {d.description && (
                  <span className="text-muted-foreground"> — {d.description}</span>
                )}
              </li>
            ))}
          </ul>
          {defsQuery.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Пока нет SOP — создайте первый.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SopIndexPage() {
  return (
    <>
      <Head>
        <title>SOP — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="SOP">
          <SopIndexInner />
        </AppShell>
      </AppRouteReady>
    </>
  );
}
