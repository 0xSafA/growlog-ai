'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { PageHead } from '@/components/layout/PageHead';
import { Button } from '@/components/ui/button';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import Link from 'next/link';
import { ListTree, MessageCircle } from 'lucide-react';

function TimelineBody() {
  const { t } = useTranslation();
  const { recentEvents, cycle, loading } = useFarmContext();

  if (loading) {
    return <p className="text-muted-foreground">{t('timeline.loading')}</p>;
  }

  if (!cycle) {
    return (
      <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-4 py-8 text-center">
        <p className="text-sm font-medium text-foreground">{t('timeline.noCycleTitle')}</p>
        <p className="mt-2 text-sm text-muted-foreground">{t('timeline.noCycleDesc')}</p>
        <Button asChild className="mt-4" size="sm">
          <Link href="/onboarding">{t('timeline.setup')}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {t('timeline.intro')}{' '}
        <span className="text-foreground font-medium">{cycle.name}</span> {t('timeline.introSuffix')}
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
          <p className="text-sm font-medium text-foreground">{t('timeline.emptyTitle')}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t('timeline.emptyDesc')}</p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button asChild size="sm">
              <Link href="/log">{t('timeline.openLog')}</Link>
            </Button>
            <Button asChild size="sm" variant="secondary">
              <Link href="/photos">{t('timeline.uploadPhoto')}</Link>
            </Button>
          </div>
        </div>
      )}
      {recentEvents.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/assistant">
              <MessageCircle className="mr-2 h-4 w-4" />
              {t('timeline.explainHistory')}
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function TimelinePageBody() {
  const { t } = useTranslation();
  return (
    <>
      <PageHead titleKey="titles.timeline" />
      <AppShell title={t('titles.timeline')}>
        <TimelineBody />
      </AppShell>
    </>
  );
}

export default function TimelinePage() {
  return (
    <AppRouteReady>
      <TimelinePageBody />
    </AppRouteReady>
  );
}
