'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { DAILY_FOCUS_INSIGHT_TYPES } from '@/lib/growlog/daily-focus-insights';
import { fetchOpenSopRuns, SOP_RUNS_QUERY_KEY } from '@/lib/growlog/sop-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EventType } from '@/types/domain';
import { formatInTimeZone } from 'date-fns-tz';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CalendarClock,
  ClipboardCheck,
  MessageCircle,
  Mic,
  Sparkles,
  Volume2,
} from 'lucide-react';

const RISK_EVENT_TYPES: Set<EventType> = new Set([
  'issue_detected',
  'pest_detected',
  'deficiency_suspected',
  'anomaly',
]);

type AiInsightRow = {
  id: string;
  title: string | null;
  body: string;
  insight_type: string;
  confidence: number | null;
  confidence_label: string | null;
  created_at: string;
};

export function DailyFocus() {
  const {
    supabase,
    farms,
    farmId,
    cycle,
    primaryScope,
    todayEvents,
    recentEvents,
    loading,
  } = useFarmContext();
  const { t } = useTranslation();

  const farm = farms.find((f) => f.id === farmId);

  const sopRunsQuery = useQuery({
    queryKey: [SOP_RUNS_QUERY_KEY, farmId, cycle?.id, 'daily-focus'],
    enabled: !!farmId && !!cycle?.id && !!farm && !loading,
    queryFn: async () => {
      const anchorDate = formatInTimeZone(
        new Date(),
        farm?.timezone ?? 'UTC',
        'yyyy-MM-dd'
      );
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return [];
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
      if (!m.ok) return [];
      return fetchOpenSopRuns(supabase, { farmId: farmId!, cycleId: cycle!.id });
    },
  });

  const focusInsightsQuery = useQuery({
    queryKey: ['ai-insights-daily-focus', farmId, cycle?.id],
    enabled: !!farmId && !!cycle?.id && !loading,
    queryFn: async (): Promise<AiInsightRow[]> => {
      const { data, error } = await supabase
        .from('ai_insights')
        .select(
          'id, title, body, insight_type, confidence, confidence_label, created_at'
        )
        .eq('farm_id', farmId!)
        .eq('cycle_id', cycle!.id)
        .in('insight_type', [...DAILY_FOCUS_INSIGHT_TYPES])
        .order('created_at', { ascending: false })
        .limit(8);
      if (error) {
        console.warn('ai_insights daily focus:', error.message);
        return [];
      }
      return (data ?? []) as AiInsightRow[];
    },
  });

  if (loading) {
    return <p className="text-muted-foreground">{t('dailyFocus.loading')}</p>;
  }

  if (!cycle || !primaryScope) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('dailyFocus.noCycleTitle')}</CardTitle>
          <CardDescription>{t('dailyFocus.noCycleDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/onboarding">{t('dailyFocus.setupFarm')}</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const dayNumber = Math.max(
    1,
    Math.ceil(
      (Date.now() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24)
    )
  );

  const riskEvents = recentEvents.filter((e) =>
    RISK_EVENT_TYPES.has(e.event_type as EventType)
  );

  const topInsight = focusInsightsQuery.data?.[0];
  const [ttsPending, setTtsPending] = useState(false);

  async function speakFocus(text: string) {
    setTtsPending(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/voice/speak', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: text.slice(0, 2000) }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      await audio.play();
    } finally {
      setTtsPending(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* ADR-005: Key snapshot — minimal, prioritization */}
      <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent">
        <CardHeader className="pb-2">
          <CardDescription>{t('dailyFocus.snapshot')}</CardDescription>
          <CardTitle className="text-xl leading-tight">{cycle.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {t('common.day')} {dayNumber} · {cycle.stage}
            {cycle.cultivar_name ? ` · ${cycle.cultivar_name}` : ''}
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            {t('dailyFocus.todayInJournal')}{' '}
            <strong className="text-foreground tabular-nums">{todayEvents.length}</strong>
          </span>
          <span className="hidden sm:inline">·</span>
          <Link href="/timeline" className="text-primary underline-offset-2 hover:underline">
            {t('dailyFocus.whatHappened')}
          </Link>
        </CardContent>
      </Card>

      {/* ADR-005: Alerts / risks first */}
      <section aria-labelledby="df-risks-heading">
        <h2 id="df-risks-heading" className="sr-only">
          {t('dailyFocus.risksHeading')}
        </h2>
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              {t('dailyFocus.risksTitle')}
            </CardTitle>
            <CardDescription>{t('dailyFocus.risksDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {riskEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('dailyFocus.noRisks')}</p>
            ) : (
              <ul className="space-y-2">
                {riskEvents.slice(0, 5).map((e) => (
                  <li
                    key={e.id}
                    className="rounded-md border border-border/60 bg-card/40 px-3 py-2 text-sm"
                  >
                    <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                      <span className="font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400">
                        {e.event_type.replace(/_/g, ' ')}
                      </span>
                      <time dateTime={e.occurred_at}>
                        {new Date(e.occurred_at).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </time>
                    </div>
                    {e.body && <p className="mt-1 leading-snug">{e.body}</p>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ADR-005: Today SOP */}
      <section aria-labelledby="df-sop-heading">
        <h2 id="df-sop-heading" className="sr-only">
          {t('dailyFocus.sopTodayHeading')}
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              {t('dailyFocus.sopTodayTitle')}
            </CardTitle>
            <CardDescription>{t('dailyFocus.sopTodayDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sopRunsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">{t('dailyFocus.loadingTasks')}</p>
            )}
            {sopRunsQuery.data && sopRunsQuery.data.length === 0 && (
              <p className="text-sm text-muted-foreground">
                {t('dailyFocus.noSop')}{' '}
                <Link href="/sop/new" className="text-primary underline">
                  {t('dailyFocus.createSop')}
                </Link>
              </p>
            )}
            <ul className="space-y-2">
              {sopRunsQuery.data?.slice(0, 4).map((r) => {
                const sopTitle =
                  r.sop_definitions &&
                  typeof r.sop_definitions === 'object' &&
                  'title' in r.sop_definitions
                    ? (r.sop_definitions as { title: string }).title
                    : 'SOP';
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {sopTitle}
                      {r.status === 'overdue' && (
                        <span className="ml-1 text-amber-600">{t('dailyFocus.overdue')}</span>
                      )}
                    </span>
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <Link href={`/sop/run/${r.id}`}>{t('dailyFocus.execute')}</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
            {(sopRunsQuery.data?.length ?? 0) > 4 && (
              <Button asChild variant="link" className="h-auto px-0 text-xs">
                <Link href="/sop">{t('dailyFocus.allSop')}</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ADR-005: AI Focus — trust signals when insight exists */}
      <section aria-labelledby="df-ai-heading">
        <h2 id="df-ai-heading" className="sr-only">
          {t('dailyFocus.aiFocusHeading')}
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              {t('dailyFocus.aiFocusTitle')}
            </CardTitle>
            <CardDescription>{t('dailyFocus.aiFocusDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {focusInsightsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">{t('dailyFocus.loadingInsights')}</p>
            )}
            {!focusInsightsQuery.isLoading && !topInsight && (
              <div className="rounded-md border border-dashed border-border/80 px-3 py-4 text-center text-sm text-muted-foreground">
                <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-50" />
                {t('dailyFocus.noInsight')}
                <div className="mt-3">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/assistant">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      {t('dailyFocus.openAssistant')}
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            {topInsight && (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                <p className="font-medium text-sm leading-snug">
                  {topInsight.title ?? t('dailyFocus.insight')}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({topInsight.insight_type.replace(/_/g, ' ')})
                  </span>
                </p>
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {topInsight.body}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{t('dailyFocus.confidence')}</span>
                  {topInsight.confidence_label ? (
                    <span className="rounded-full bg-background px-2 py-0.5 capitalize">
                      {topInsight.confidence_label}
                      {topInsight.confidence != null &&
                        ` (${Math.round(Number(topInsight.confidence) * 100)}%)`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">{t('dailyFocus.confidenceUnknown')}</span>
                  )}
                </div>
                <Button asChild variant="link" className="h-auto px-0 text-xs">
                  <Link href="/assistant">{t('dailyFocus.moreInAssistant')}</Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-1"
                  disabled={ttsPending}
                  onClick={() => void speakFocus(topInsight.body)}
                >
                  <Volume2 className="mr-2 h-4 w-4" />
                  {ttsPending ? t('dailyFocus.ttsPending') : t('dailyFocus.speak')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ADR-005: Quick actions — secondary; primary capture is global FAB */}
      <section aria-labelledby="df-quick-heading">
        <h2 id="df-quick-heading" className="sr-only">
          {t('dailyFocus.quickActionsHeading')}
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('dailyFocus.quickActionsTitle')}</CardTitle>
            <CardDescription>{t('dailyFocus.quickActionsDesc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/log?tab=voice">
                <Mic className="mr-2 h-4 w-4" />
                {t('common.voice')}
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/photos">{t('nav.photos')}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sensors">{t('dailyFocus.measurement')}</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sop">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                {t('nav.sop')}
              </Link>
            </Button>
          </CardContent>
        </Card>
      </section>

      {/* Recent timeline teaser */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarClock className="h-5 w-5" />
            {t('dailyFocus.recentHistory')}
          </CardTitle>
          <CardDescription>{t('dailyFocus.recentHistoryDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('dailyFocus.emptyHistory')}</p>
          ) : (
            <ul className="space-y-3">
              {recentEvents.slice(0, 6).map((e) => (
                <li
                  key={e.id}
                  className="flex flex-col gap-0.5 border-b border-border/60 pb-3 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span className="font-medium uppercase tracking-wide text-primary">
                      {e.event_type.replace(/_/g, ' ')}
                    </span>
                    <time dateTime={e.occurred_at}>
                      {new Date(e.occurred_at).toLocaleString(undefined, {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </time>
                  </div>
                  {e.body && <p className="text-sm leading-snug">{e.body}</p>}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild variant="link" className="h-auto px-0">
              <Link href="/timeline">{t('dailyFocus.fullTimeline')}</Link>
            </Button>
            <Button asChild variant="link" className="h-auto px-0">
              <Link href="/assistant">{t('dailyFocus.askAboutHistory')}</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
