'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';
import { AlertTriangle, CalendarClock, Mic, PenLine } from 'lucide-react';

export function DailyFocus() {
  const {
    farms,
    farmId,
    cycle,
    primaryScope,
    todayEvents,
    recentEvents,
    loading,
  } = useFarmContext();

  const farm = farms.find((f) => f.id === farmId);

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

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardDescription>Текущий цикл</CardDescription>
          <CardTitle className="text-2xl">{cycle.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {farm?.name} · День {dayNumber} · {cycle.stage} · {cycle.cultivar_name ?? 'сорт не указан'}
          </p>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href="/log">
              <PenLine className="mr-2 h-4 w-4" />
              Быстрая запись
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/log?tab=voice">
              <Mic className="mr-2 h-4 w-4" />
              Голос
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm">
            <Link href="/photos">Загрузить фото</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/sensors">Замер</Link>
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClock className="h-4 w-4" />
              Сегодня в журнале
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{todayEvents.length}</p>
            <p className="text-sm text-muted-foreground">событий за сегодня</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Операционный режим
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Журнал и голос (этап 2). SOP и ИИ-ассистент — в следующих этапах ADR-001.
            </p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Последние события</CardTitle>
          <CardDescription>Хронология — источник правды для будущего ассистента.</CardDescription>
        </CardHeader>
        <CardContent>
          {recentEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока пусто — добавьте первую запись.</p>
          ) : (
            <ul className="space-y-3">
              {recentEvents.slice(0, 8).map((e) => (
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
          <Button asChild variant="link" className="mt-4 h-auto px-0">
            <Link href="/timeline">Весь таймлайн →</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
