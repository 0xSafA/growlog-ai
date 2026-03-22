'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { fetchReportsForFarm } from '@/lib/growlog/report-queries';
import { AUDIENCE_TYPES, OUTPUT_FORMATS, REPORT_TYPES } from '@/types/report';
import { useQuery } from '@tanstack/react-query';
import { formatInTimeZone } from 'date-fns-tz';
import Head from 'next/head';
import Link from 'next/link';
import { useMemo, useState } from 'react';

function ReportsInner() {
  const { supabase, farmId, cycle, primaryScope, farms } = useFarmContext();
  const farm = farms.find((f) => f.id === farmId);
  const tz = farm?.timezone ?? 'UTC';

  const today = useMemo(
    () => formatInTimeZone(new Date(), tz, 'yyyy-MM-dd'),
    [tz]
  );

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reportType, setReportType] = useState<string>('daily');
  const [audienceType, setAudienceType] = useState<string>('internal_operational');
  const [outputFormat, setOutputFormat] = useState<string>('html');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['reports', farmId],
    enabled: !!farmId,
    queryFn: () => fetchReportsForFarm(supabase, farmId!),
  });

  async function onGenerate() {
    if (!farmId || !cycle) return;
    setError(null);
    setBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error('Нет сессии');
      const res = await fetch('/api/reports/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          farmId,
          cycleId: cycle.id,
          scopeId: primaryScope?.id ?? null,
          reportType,
          audienceType,
          outputFormat,
          startDate,
          endDate,
          title: title.trim() || undefined,
        }),
      });
      const j = (await res.json()) as { error?: string; reportId?: string; detail?: string };
      if (!res.ok) {
        throw new Error(j.detail || j.error || 'generate_failed');
      }
      await listQuery.refetch();
      if (j.reportId) {
        window.location.href = `/reports/${j.reportId}`;
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Ошибка');
    } finally {
      setBusy(false);
    }
  }

  if (!cycle) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">Нужен активный цикл</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Отчёт строится по событиям цикла. Создайте цикл в онбординге или настройках.
        </p>
        <Button asChild className="mt-4" size="sm" variant="secondary">
          <Link href="/onboarding">Настроить ферму</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="text-sm text-muted-foreground">
        Отчёты собираются из той же истории, что и таймлайн — не из отдельного редактора. При
        нехватке событий сначала накопите журнал.{' '}
        <Link href="/timeline" className="text-primary underline underline-offset-2">
          Таймлайн
        </Link>
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Новый отчёт</CardTitle>
          <CardDescription>
            Запрос создаёт черновик и ставит фоновую задачу <code className="text-xs">report.generate</code>
            .
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-sm font-medium">Тип</label>
              <select
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
              >
                {REPORT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Аудитория</label>
              <select
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                value={audienceType}
                onChange={(e) => setAudienceType(e.target.value)}
              >
                {AUDIENCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Формат вывода</label>
              <select
                className="w-full rounded-md border border-input bg-background px-2 py-2 text-sm"
                value={outputFormat}
                onChange={(e) => setOutputFormat(e.target.value)}
              >
                {OUTPUT_FORMATS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Заголовок (опц.)</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Авто" />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Начало периода</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Конец периода</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="button" onClick={onGenerate} disabled={busy}>
            {busy ? 'Отправка…' : 'Собрать отчёт'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последние отчёты</CardTitle>
          <CardDescription>Статус обновится после worker.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {listQuery.isLoading && (
            <p className="text-sm text-muted-foreground">Загрузка…</p>
          )}
          {listQuery.data?.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Пока нет готовых отчётов. Если в журнале мало записей, материала для отчёта может не
              хватить — начните с фокуса дня и таймлайна.
            </p>
          )}
          <ul className="space-y-2">
            {listQuery.data?.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reports/${r.id}`}
                  className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <span className="font-medium">{r.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {r.status} · {r.report_type}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ReportsIndexPage() {
  return (
    <>
      <Head>
        <title>Отчёты — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Отчёты">
          <ReportsInner />
        </AppShell>
      </AppRouteReady>
    </>
  );
}
