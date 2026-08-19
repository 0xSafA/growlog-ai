'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { PageHead } from '@/components/layout/PageHead';
import { VoiceLogFlow } from '@/components/voice/VoiceLogFlow';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { createLogEntry } from '@/lib/growlog/mutations';
import type { EventType, SourceType } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

const QUICK_TYPES: EventType[] = [
  'note',
  'observation',
  'action_taken',
  'watering',
  'feeding',
  'issue_detected',
];

function LogForm() {
  const { t } = useTranslation();
  const { supabase, farmId, cycle, primaryScope, refetchAll, userId } = useFarmContext();
  const [eventType, setEventType] = useState<EventType>('note');
  const [body, setBody] = useState('');
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !cycle || !primaryScope) return;
    setError(null);
    setPending(true);
    try {
      const iso = new Date(occurredAt).toISOString();
      await createLogEntry(supabase, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        eventType,
        body,
        occurredAt: iso,
        sourceType: 'user_form' as SourceType,
        createdBy: userId,
      });
      setBody('');
      await refetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('log.saveFailed'));
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return <p className="text-muted-foreground">{t('log.needOnboarding')}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('log.textTitle')}</CardTitle>
        <CardDescription>{t('log.textDesc')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('log.eventType')}</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={eventType}
              onChange={(e) => setEventType(e.target.value as EventType)}
            >
              {QUICK_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('common.text')}</label>
            <textarea
              className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              required
              placeholder={t('log.bodyPlaceholder')}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('common.whenLocal')}</label>
            <Input
              type="datetime-local"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? t('common.saving') : t('log.submit')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function LogTabs() {
  const { t } = useTranslation();
  const router = useRouter();
  const [mode, setMode] = useState<'text' | 'voice'>('text');

  useEffect(() => {
    if (!router.isReady) return;
    const q = router.query.tab;
    if (q === 'voice') setMode('voice');
    else if (q === undefined || q === '') setMode('text');
  }, [router.isReady, router.query.tab]);

  function switchMode(next: 'text' | 'voice') {
    setMode(next);
    void router.replace(
      { pathname: '/log', query: next === 'voice' ? { tab: 'voice' } : {} },
      undefined,
      { shallow: true }
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg border border-border/80 bg-muted/40 p-1">
        <button
          type="button"
          className={cn(
            'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
            mode === 'text' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => switchMode('text')}
        >
          {t('common.text')}
        </button>
        <button
          type="button"
          className={cn(
            'flex-1 rounded-md py-2 text-sm font-medium transition-colors',
            mode === 'voice' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => switchMode('voice')}
        >
          {t('common.voice')}
        </button>
      </div>
      {mode === 'text' ? <LogForm /> : <VoiceLogFlow />}
    </div>
  );
}

function LogPageBody() {
  const { t } = useTranslation();
  return (
    <>
      <PageHead titleKey="titles.log" />
      <AppShell title={t('titles.log')}>
        <LogTabs />
      </AppShell>
    </>
  );
}

export default function LogPage() {
  return (
    <AppRouteReady>
      <LogPageBody />
    </AppRouteReady>
  );
}
