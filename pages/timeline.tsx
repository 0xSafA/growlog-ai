'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { useFarmContext } from '@/components/providers/FarmProvider';
import Head from 'next/head';
import Link from 'next/link';
import { ListTree, MessageCircle } from 'lucide-react';

function TimelineBody() {
  const { recentEvents, cycle, loading } = useFarmContext();

  if (loading) {
    return <p className="text-muted-foreground">Загрузка…</p>;
  }

  if (!cycle) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">Нет активного цикла</p>
        <p className="mt-2 text-sm text-muted-foreground">
          Таймлайн привязан к циклу выращивания. Создайте цикл в онбординге или настройках.
        </p>
        <Button asChild className="mt-4" size="sm">
          <Link href="/onboarding">Настроить</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Хронология событий цикла{' '}
        <span className="text-foreground font-medium">{cycle.name}</span> — источник фактов для
        ассистента и отчётов.
      </p>
      {recentEvents.length > 0 && (
        <ul className="space-y-4">
          {recentEvents.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-border/80 bg-card/50 px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-primary">
                  {e.event_type.replace(/_/g, ' ')}
                </span>
                <time className="text-xs text-muted-foreground" dateTime={e.occurred_at}>
                  {new Date(e.occurred_at).toLocaleString()}
                </time>
              </div>
              {e.title && <p className="mt-1 font-medium">{e.title}</p>}
              {e.body && (
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.body}</p>
              )}
            </li>
          ))}
        </ul>
      )}
      {recentEvents.length === 0 && (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
          <ListTree className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" />
          <p className="text-sm font-medium text-foreground">История пока пуста</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Зафиксируйте первое событие — кнопка «Запись» внизу экрана или голос / фото.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href="/log">Открыть запись</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/photos">Загрузить фото</Link>
            </Button>
          </div>
        </div>
      )}
      {recentEvents.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/assistant">
              <MessageCircle className="mr-2 h-4 w-4" />
              Объяснить по истории
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

export default function TimelinePage() {
  return (
    <>
      <Head>
        <title>Таймлайн — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Таймлайн">
          <TimelineBody />
        </AppShell>
      </AppRouteReady>
    </>
  );
}
