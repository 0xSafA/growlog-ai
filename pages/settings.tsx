'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Head from 'next/head';
import { useEffect, useState } from 'react';

function SettingsBody() {
  const { supabase, farms, farmId, setFarmId, cycle, refetchAll } = useFarmContext();
  const farm = farms.find((f) => f.id === farmId);
  const [name, setName] = useState(farm?.name ?? '');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (farm) setName(farm.name);
  }, [farm]);

  async function saveFarmName(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    setPending(true);
    setMsg(null);
    try {
      const { error } = await supabase.from('farms').update({ name: name.trim() }).eq('id', farmId);
      if (error) throw error;
      await refetchAll();
      setMsg('Сохранено');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Ферма</CardTitle>
          <CardDescription>Название и идентификаторы (ADR-002 `farms`).</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveFarmName} className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? '…' : 'Сохранить название'}
            </Button>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </form>
        </CardContent>
      </Card>

      {farms.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Активная ферма</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={farmId ?? ''}
              onChange={(e) => setFarmId(e.target.value)}
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {cycle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Активный цикл</CardTitle>
            <CardDescription>
              {cycle.name} · {cycle.stage} · с {cycle.start_date}
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

export default function SettingsPage() {
  return (
    <>
      <Head>
        <title>Настройки — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Настройки">
          <SettingsBody />
        </AppShell>
      </AppRouteReady>
    </>
  );
}
