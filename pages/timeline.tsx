'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { useFarmContext } from '@/components/providers/FarmProvider';
import Head from 'next/head';

function TimelineBody() {
  const { recentEvents, cycle, loading } = useFarmContext();

  if (loading || !cycle) {
    return <p className="text-muted-foreground">Загрузка…</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Цикл: <span className="text-foreground">{cycle.name}</span>
      </p>
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
            {e.body && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{e.body}</p>}
          </li>
        ))}
      </ul>
      {recentEvents.length === 0 && (
        <p className="text-center text-sm text-muted-foreground">Событий пока нет.</p>
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
