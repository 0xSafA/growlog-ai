'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { createSopDefinitionWithAssignment } from '@/lib/growlog/sop-mutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

export default function SopNewPage() {
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
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return (
      <AppRouteReady>
        <AppShell title="Новый SOP">
          <p className="text-muted-foreground">Нужен активный цикл и scope.</p>
        </AppShell>
      </AppRouteReady>
    );
  }

  return (
    <>
      <Head>
        <title>Новый SOP — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Новый SOP">
          <Card className="max-w-lg">
            <CardHeader>
              <CardTitle>Ежедневный регламент</CardTitle>
              <CardDescription>
                Создаётся определение, триггер <code className="text-xs">recurring_daily</code> и
                назначение на текущий цикл и основной scope.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Название</label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Описание</label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Локальное время «срока» (ферма)</label>
                  <Input
                    type="time"
                    value={localTime}
                    onChange={(e) => setLocalTime(e.target.value)}
                    required
                  />
                  <p className="text-xs text-muted-foreground">
                    Интерпретируется в таймзоне фермы при материализации run.
                  </p>
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
                <div className="flex gap-2">
                  <Button type="submit" disabled={pending}>
                    {pending ? 'Сохранение…' : 'Создать'}
                  </Button>
                  <Button type="button" variant="outline" asChild>
                    <Link href="/sop">Отмена</Link>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </AppShell>
      </AppRouteReady>
    </>
  );
}
