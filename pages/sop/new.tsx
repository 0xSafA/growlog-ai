'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { PageHead } from '@/components/layout/PageHead';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { createSopDefinitionWithAssignment } from '@/lib/growlog/sop-mutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

function SopNewBody() {
  const { t } = useTranslation();
  const router = useRouter();
  const { supabase, farmId, cycle, primaryScope } = useFarmContext();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [localTime, setLocalTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !cycle || !primaryScope) return;
    setError(null);
    setPending(true);
    try {
      await createSopDefinitionWithAssignment(supabase, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        title,
        description,
        localTime,
        appliesToScope: 'tent',
      });
      await router.push('/sop');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return (
      <>
        <PageHead titleKey="titles.sopNew" />
        <AppShell title={t('titles.sopNew')}>
          <p className="text-muted-foreground">{t('sop.needCycleScope')}</p>
        </AppShell>
      </>
    );
  }

  return (
    <>
      <PageHead titleKey="titles.sopNew" />
      <AppShell title={t('titles.sopNew')}>
        <Card className="max-w-lg">
          <CardHeader>
            <CardTitle>{t('sop.dailyTitle')}</CardTitle>
            <CardDescription>{t('sop.newDescTechnical')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('sop.titleLabel')}</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('sop.descriptionLabel')}</label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('sop.dueTimeLabel')}</label>
                <Input
                  type="time"
                  value={localTime}
                  onChange={(e) => setLocalTime(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">{t('sop.dueTimeHint')}</p>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <div className="flex gap-2">
                <Button type="submit" disabled={pending}>
                  {pending ? t('common.saving') : t('common.create')}
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/sop">{t('common.cancel')}</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </AppShell>
    </>
  );
}

export default function SopNewPage() {
  return (
    <AppRouteReady>
      <SopNewBody />
    </AppRouteReady>
  );
}
