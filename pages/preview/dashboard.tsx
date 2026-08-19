'use client';

import { CaptureFab } from '@/components/layout/CaptureFab';
import { AppShell } from '@/components/layout/AppShell';
import { PageHead } from '@/components/layout/PageHead';
import { useTranslation } from '@/components/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  AlertTriangle,
  Brain,
  ClipboardCheck,
  MessageCircle,
  Mic,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/** Localhost-only UI preview for screenshots and design review. */
export default function DashboardPreviewPage() {
  const router = useRouter();
  const { t } = useTranslation();

  useEffect(() => {
    const host = window.location.hostname;
    if (host !== 'localhost' && host !== '127.0.0.1') {
      void router.replace('/');
    }
  }, [router]);

  return (
    <>
      <PageHead titleKey="titles.dashboard" />
      <AppShell title={t('titles.dashboard')}>
        <div className="space-y-5">
          <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent">
            <CardHeader className="pb-2">
              <CardDescription>{t('dailyFocus.snapshot')}</CardDescription>
              <CardTitle className="text-xl leading-tight">Spring 2026</CardTitle>
              <p className="text-sm text-muted-foreground">
                {t('common.day')} 24 · veg · Blue Dream
              </p>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                {t('dailyFocus.todayInJournal')}{' '}
                <strong className="text-foreground tabular-nums">3</strong>
              </span>
              <span className="hidden sm:inline">·</span>
              <Link href="/timeline" className="text-primary underline-offset-2 hover:underline">
                {t('dailyFocus.whatHappened')}
              </Link>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                {t('dailyFocus.risksTitle')}
              </CardTitle>
              <CardDescription>{t('dailyFocus.risksDesc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{t('dailyFocus.noRisks')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {t('dailyFocus.sopTodayTitle')}
              </CardTitle>
              <CardDescription>{t('dailyFocus.sopTodayDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>Check pH / EC</span>
                <Button size="sm" variant="outline" className="shrink-0">
                  {t('dailyFocus.execute')}
                </Button>
              </div>
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>
                  Canopy LST <span className="text-amber-600">{t('dailyFocus.overdue')}</span>
                </span>
                <Button size="sm" variant="outline" className="shrink-0">
                  {t('dailyFocus.execute')}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="h-4 w-4 text-primary" />
                {t('dailyFocus.aiFocusTitle')}
              </CardTitle>
              <CardDescription>{t('dailyFocus.aiFocusDesc')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="rounded-lg border border-grow-leaf/15 bg-grow-sage/30 px-3 py-2 text-sm leading-relaxed">
                <p className="flex items-center gap-1.5 font-medium text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  Humidity trending up
                </p>
                <p className="mt-1 text-muted-foreground">
                  Last 3 days: 58→62→65%. Consider increasing airflow before flower stretch.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" className="gap-1.5">
                  <MessageCircle className="h-3.5 w-3.5" />
                  {t('dailyFocus.openAssistant')}
                </Button>
                <Button size="sm" variant="ghost" className="gap-1.5">
                  <Mic className="h-3.5 w-3.5" />
                  {t('dailyFocus.speak')}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </AppShell>
      <CaptureFab />
    </>
  );
}
