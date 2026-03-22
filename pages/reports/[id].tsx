'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { ReportViewer } from '@/components/reports/ReportViewer';
import { Button } from '@/components/ui/button';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { fetchReportById } from '@/lib/growlog/report-queries';
import type { ReportBlock, ReportJsonV1 } from '@/types/report';
import { useQuery } from '@tanstack/react-query';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';

function isReportJsonV1(x: unknown): x is ReportJsonV1 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.pipeline_version === 'adr007-v1' && Array.isArray(o.blocks);
}

export default function ReportDetailPage() {
  const router = useRouter();
  const id = typeof router.query.id === 'string' ? router.query.id : null;
  const { supabase, farmId } = useFarmContext();

  const q = useQuery({
    queryKey: ['report', farmId, id],
    enabled: !!farmId && !!id,
    queryFn: () => fetchReportById(supabase, farmId!, id!),
  });

  const report = q.data;
  const rj = report?.report_json;
  const blocks: ReportBlock[] =
    isReportJsonV1(rj) && rj.blocks.length ? rj.blocks : [];

  return (
    <>
      <Head>
        <title>{report?.title ? `${report.title} — Отчёт` : 'Отчёт — Growlog AI'}</title>
      </Head>
      <AppRouteReady>
        <AppShell title={report?.title ?? 'Отчёт'}>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/reports">К списку</Link>
              </Button>
            </div>

            {q.isLoading && <p className="text-sm text-muted-foreground">Загрузка…</p>}
            {q.isError && <p className="text-sm text-destructive">Не удалось загрузить отчёт.</p>}
            {report && (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Статус: <span className="text-foreground">{report.status}</span> · тип:{' '}
                  {report.report_type} · аудитория: {report.audience_type ?? 'internal_operational'}
                </p>
                {report.period_start && report.period_end && (
                  <p>
                    Период: {report.period_start.slice(0, 10)} — {report.period_end.slice(0, 10)}
                  </p>
                )}
              </div>
            )}

            {report?.status === 'draft' && (
              <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
                Отчёт ещё собирается worker-ом (<code>report.generate</code>). Обновите страницу через
                несколько секунд.
              </p>
            )}

            {report && blocks.length > 0 && (
              <ReportViewer blocks={blocks} supabase={supabase} />
            )}

            {report && report.status === 'ready' && blocks.length === 0 && (
              <p className="text-sm text-muted-foreground">Нет блоков в report_json.</p>
            )}
          </div>
        </AppShell>
      </AppRouteReady>
    </>
  );
}
