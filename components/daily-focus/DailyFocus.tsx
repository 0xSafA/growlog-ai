'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { DAILY_FOCUS_INSIGHT_TYPES } from '@/lib/growlog/daily-focus-insights';
import { fetchOpenSopRuns, SOP_RUNS_QUERY_KEY } from '@/lib/growlog/sop-queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { EventType } from '@/types/domain';
import { formatInTimeZone } from 'date-fns-tz';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle,
  Brain,
  CalendarClock,
  ClipboardCheck,
  MessageCircle,
  Mic,
  Sparkles,
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
    return <p className="text-muted-foreground">Загрузка данных цикла…</p>;
  }

  if (!cycle || !primaryScope) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Нет активного цикла</CardTitle>
          <CardDescription>
            Создайте цикл выращивания в настройках или через поддержку — для журнала нужен цикл и
            область (scope).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline">
            <Link href="/onboarding">Настроить ферму</Link>
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

  return (
    <div className="space-y-5">
      {/* ADR-005: Key snapshot — minimal, prioritization */}
      <Card className="border-primary/15 bg-gradient-to-br from-primary/[0.06] to-transparent">
        <CardHeader className="pb-2">
          <CardDescription>Снимок цикла</CardDescription>
          <CardTitle className="text-xl leading-tight">{cycle.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            День {dayNumber} · {cycle.stage}
            {cycle.cultivar_name ? ` · ${cycle.cultivar_name}` : ''}
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>
            Сегодня в журнале:{' '}
            <strong className="text-foreground tabular-nums">{todayEvents.length}</strong>
          </span>
          <span className="hidden sm:inline">·</span>
          <Link href="/timeline" className="text-primary underline-offset-2 hover:underline">
            Что было → таймлайн
          </Link>
        </CardContent>
      </Card>

      {/* ADR-005: Alerts / risks first */}
      <section aria-labelledby="df-risks-heading">
        <h2 id="df-risks-heading" className="sr-only">
          Риски и отклонения
        </h2>
        <Card className="border-amber-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              Риски и сигналы
            </CardTitle>
            <CardDescription>
              События типа проблема / вредитель / дефицит / аномалия из недавней истории.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {riskEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Критичных сигналов в последних записях нет. При появлении проблемы зафиксируйте её
                записью — это основа для ассистента и отчётов.
              </p>
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
          SOP на сегодня
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4 text-primary" />
              SOP сегодня
            </CardTitle>
            <CardDescription>Открытые регламенты — главный сценарий работы гровера.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {sopRunsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Загрузка задач…</p>
            )}
            {sopRunsQuery.data && sopRunsQuery.data.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Нет открытых регламентов.{' '}
                <Link href="/sop/new" className="text-primary underline">
                  Создать SOP
                </Link>
              </p>
            )}
            <ul className="space-y-2">
              {sopRunsQuery.data?.slice(0, 4).map((r) => {
                const t =
                  r.sop_definitions &&
                  typeof r.sop_definitions === 'object' &&
                  'title' in r.sop_definitions
                    ? (r.sop_definitions as { title: string }).title
                    : 'SOP';
                return (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate">
                      {t}
                      {r.status === 'overdue' && (
                        <span className="ml-1 text-amber-600">· просрочено</span>
                      )}
                    </span>
                    <Button asChild size="sm" variant="outline" className="shrink-0">
                      <Link href={`/sop/run/${r.id}`}>Выполнить</Link>
                    </Button>
                  </li>
                );
              })}
            </ul>
            {(sopRunsQuery.data?.length ?? 0) > 4 && (
              <Button asChild variant="link" className="h-auto px-0 text-xs">
                <Link href="/sop">Все SOP →</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ADR-005: AI Focus — trust signals when insight exists */}
      <section aria-labelledby="df-ai-heading">
        <h2 id="df-ai-heading" className="sr-only">
          Фокус ИИ
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Brain className="h-4 w-4 text-primary" />
              Фокус ИИ
            </CardTitle>
            <CardDescription>
              Показываем последний сохранённый инсайт (фокус дня, риск, сводка по фактам, паттерн,
              объяснение причин, блок истории и т.д.). Развёрнуто — в ассистенте.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {focusInsightsQuery.isLoading && (
              <p className="text-sm text-muted-foreground">Загрузка инсайтов…</p>
            )}
            {!focusInsightsQuery.isLoading && !topInsight && (
              <div className="rounded-md border border-dashed border-border/80 px-3 py-4 text-center text-sm text-muted-foreground">
                <Sparkles className="mx-auto mb-2 h-8 w-8 opacity-50" />
                Пока нет сохранённого фокуса по циклу. Спросите ассистента — ответ можно сохранить
                как инсайт при наличии данных в журнале.
                <div className="mt-3">
                  <Button asChild size="sm" variant="secondary">
                    <Link href="/assistant">
                      <MessageCircle className="mr-2 h-4 w-4" />
                      Открыть ассистента
                    </Link>
                  </Button>
                </div>
              </div>
            )}
            {topInsight && (
              <div className="space-y-2 rounded-md border border-border/60 bg-muted/30 px-3 py-3">
                <p className="font-medium text-sm leading-snug">
                  {topInsight.title ?? 'Инсайт'}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({topInsight.insight_type.replace(/_/g, ' ')})
                  </span>
                </p>
                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                  {topInsight.body}
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Уверенность:</span>
                  {topInsight.confidence_label ? (
                    <span className="rounded-full bg-background px-2 py-0.5 capitalize">
                      {topInsight.confidence_label}
                      {topInsight.confidence != null &&
                        ` (${Math.round(Number(topInsight.confidence) * 100)}%)`}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">не указана</span>
                  )}
                </div>
                <Button asChild variant="link" className="h-auto px-0 text-xs">
                  <Link href="/assistant">Подробнее в ассистенте →</Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ADR-005: Quick actions — secondary; primary capture is global FAB */}
      <section aria-labelledby="df-quick-heading">
        <h2 id="df-quick-heading" className="sr-only">
          Быстрые действия
        </h2>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Быстрые действия</CardTitle>
            <CardDescription>
              Основная запись — кнопка «Запись» внизу экрана. Здесь — короткие пути.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href="/log?tab=voice">
                <Mic className="mr-2 h-4 w-4" />
                Голос
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/photos">Фото</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sensors">Замер</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href="/sop">
                <ClipboardCheck className="mr-2 h-4 w-4" />
                Все SOP
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
            Недавняя история
          </CardTitle>
          <CardDescription>Таймлайн — источник правды; ассистент опирается на эти записи.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              История пуста — сделайте первую запись кнопкой «Запись» или добавьте фото.
            </p>
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
              <Link href="/timeline">Весь таймлайн →</Link>
            </Button>
            <Button asChild variant="link" className="h-auto px-0">
              <Link href="/assistant">Спросить про историю →</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
