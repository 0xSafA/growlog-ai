'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { createFoundationSetup } from '@/lib/growlog/mutations';
import { GrowEcoBackdrop } from '@/components/layout/GrowEcoBackdrop';
import { PageHead } from '@/components/layout/PageHead';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sprout } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function OnboardingPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const { supabase, authLoading, userId, farms, farmListReady, refetchAll } = useFarmContext();
  const [farmName, setFarmName] = useState('');
  const [tz, setTz] = useState(
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC'
  );
  const [cycleName, setCycleName] = useState(t('onboarding.defaultCycleName'));
  const [cultivar, setCultivar] = useState('');
  const [stage, setStage] = useState('veg');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      void router.replace('/auth/login');
    }
  }, [authLoading, userId, router]);

  useEffect(() => {
    if (!farmListReady) return;
    if (farms.length > 0) {
      void router.replace('/dashboard');
    }
  }, [farmListReady, farms.length, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setPending(true);
    try {
      const start = new Date().toISOString().slice(0, 10);
      await createFoundationSetup(supabase, {
        farmName: farmName.trim(),
        timezone: tz,
        cycleName: cycleName.trim() || t('onboarding.defaultCycleName'),
        cultivarName: cultivar.trim() || undefined,
        startDate: start,
        stage,
      });
      await refetchAll();
      await router.replace('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setPending(false);
    }
  }

  if (authLoading || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  return (
    <>
      <PageHead titleKey="titles.onboarding" />
      <GrowEcoBackdrop className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
        <div className="mb-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
            <Sprout className="h-4 w-4 text-primary" />
            {t('appName')}
          </Link>
          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </div>
        <Card className="border-grow-leaf/20 bg-card/90 shadow-lg shadow-grow-leaf/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle>{t('onboarding.title')}</CardTitle>
            <CardDescription>{t('onboarding.description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('onboarding.farmName')}</label>
                <Input
                  value={farmName}
                  onChange={(e) => setFarmName(e.target.value)}
                  className="border-grow-leaf/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('onboarding.timezone')}</label>
                <Input
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  className="border-grow-leaf/20"
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('onboarding.cycleName')}</label>
                <Input
                  value={cycleName}
                  onChange={(e) => setCycleName(e.target.value)}
                  className="border-grow-leaf/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('onboarding.cultivar')}</label>
                <Input
                  value={cultivar}
                  onChange={(e) => setCultivar(e.target.value)}
                  className="border-grow-leaf/20"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('onboarding.stage')}</label>
                <select
                  className="flex h-10 w-full rounded-md border border-grow-leaf/20 bg-background px-3 py-2 text-sm"
                  value={stage}
                  onChange={(e) => setStage(e.target.value)}
                >
                  <option value="propagation">propagation</option>
                  <option value="veg">veg</option>
                  <option value="flower">flower</option>
                  <option value="drying">drying</option>
                  <option value="curing">curing</option>
                  <option value="completed">completed</option>
                </select>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" className="w-full shadow-md shadow-primary/15" disabled={pending}>
                {pending ? t('common.creating') : t('onboarding.submit')}
              </Button>
            </form>
          </CardContent>
        </Card>
      </GrowEcoBackdrop>
    </>
  );
}
