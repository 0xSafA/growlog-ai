'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { ReportViewer } from '@/components/reports/ReportViewer';
import { Button } from '@/components/ui/button';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { fetchReportById } from '@/lib/growlog/report-queries';
import { pageTitle } from '@/lib/i18n/translate';
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

function ReportDetailBody() {
  const { t } = useTranslation();
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

  const headTitle = report?.title
    ? `${report.title} — ${t('titles.report')}`
    : pageTitle(t, 'titles.report');

  return (
    <>
      <Head>
        <title>{headTitle}</title>
      </Head>
      <AppShell title={report?.title ?? t('titles.report')}>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/reports">{t('reports.backToList')}</Link>
            </Button>
          </div>

          {q.isLoading && <p className="text-sm text-muted-foreground">{t('common.loading')}</p>}
          {q.isError && <p className="text-sm text-destructive">{t('reports.loadFailed')}</p>}
          {report && (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>
                {t('reports.statusLabel')}{' '}
                <span className="text-foreground">{report.status}</span> · {t('reports.typeLabel')}{' '}
                {report.report_type} · {t('reports.audienceLabel')}{' '}
                {report.audience_type ?? 'internal_operational'}
              </p>
              {report.period_start && report.period_end && (
                <p>
                  {t('reports.periodLabel')} {report.period_start.slice(0, 10)} —{' '}
                  {report.period_end.slice(0, 10)}
                </p>
              )}
            </div>
          )}

          {report?.status === 'draft' && (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm">
              {t('reports.draftPending')}
            </p>
          )}

          {report && blocks.length > 0 && (
            <ReportViewer blocks={blocks} supabase={supabase} />
          )}

          {report && report.status === 'ready' && blocks.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('reports.noBlocks')}</p>
          )}
        </div>
      </AppShell>
    </>
  );
}

export default function ReportDetailPage() {
  return (
    <AppRouteReady>
      <ReportDetailBody />
    </AppRouteReady>
  );
}
