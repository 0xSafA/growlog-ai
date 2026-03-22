'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { createCycleWithDefaultScope, createFarm } from '@/lib/growlog/mutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

export default function OnboardingPage() {
  const router = useRouter();
  const { supabase, authLoading, userId, farms, farmListReady, refetchAll } = useFarmContext();
  const [farmName, setFarmName] = useState('');
  const [tz, setTz] = useState(
    typeof Intl !== 'undefined'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : 'UTC'
  );
  const [cycleName, setCycleName] = useState('Цикл 1');
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
      void router.replace('/');
    }
  }, [farmListReady, farms.length, router]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setPending(true);
    try {
      const farmId = await createFarm(supabase, farmName.trim(), tz);
      const start = new Date().toISOString().slice(0, 10);
      await createCycleWithDefaultScope(supabase, {
        farmId,
        name: cycleName.trim() || 'Цикл 1',
        cultivarName: cultivar.trim() || undefined,
        startDate: start,
        stage,
        createdBy: userId,
      });
      await refetchAll();
      await router.replace('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setPending(false);
    }
  }

  if (authLoading || !userId) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Загрузка…
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Онбординг — Growlog AI</title>
      </Head>
      <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Первая ферма</CardTitle>
            <CardDescription>
              Foundation MVP (ADR-001): ферма → активный цикл → scope «Main» для журнала.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Название фермы / сетапа</label>
                <Input value={farmName} onChange={(e) => setFarmName(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Таймзона</label>
                <Input value={tz} onChange={(e) => setTz(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Название цикла</label>
                <Input value={cycleName} onChange={(e) => setCycleName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Сорт (опционально)</label>
                <Input value={cultivar} onChange={(e) => setCultivar(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Стадия</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
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
              <Button type="submit" className="w-full" disabled={pending}>
                {pending ? 'Создание…' : 'Создать ферму и цикл'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
