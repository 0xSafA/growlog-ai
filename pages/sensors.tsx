'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { fetchGlobalSensorMetrics } from '@/lib/growlog/queries';
import { createManualSensorReading } from '@/lib/growlog/mutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Head from 'next/head';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

function SensorForm() {
  const { supabase, farmId, cycle, primaryScope, refetchAll, userId } = useFarmContext();
  const metricsQuery = useQuery({
    queryKey: ['sensor-metrics-global'],
    queryFn: () => fetchGlobalSensorMetrics(supabase),
  });
  const [metricId, setMetricId] = useState('');
  const [value, setValue] = useState('');
  const [capturedAt, setCapturedAt] = useState(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !cycle || !primaryScope || !metricId) return;
    const m = metricsQuery.data?.find((x) => x.id === metricId);
    setError(null);
    setPending(true);
    try {
      const num = parseFloat(value.replace(',', '.'));
      if (Number.isNaN(num)) throw new Error('Введите число');
      const iso = new Date(capturedAt).toISOString();
      await createManualSensorReading(supabase, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        metricId,
        value: num,
        capturedAt: iso,
        unit: m?.unit ?? null,
        userId,
      });
      setValue('');
      await refetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return <p className="text-muted-foreground">Нужен активный цикл.</p>;
  }

  if (metricsQuery.isLoading) {
    return <p className="text-muted-foreground">Загрузка метрик…</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ручной замер</CardTitle>
        <CardDescription>
          Создаётся `sensor_readings` и событие `sensor_snapshot` с связью через `event_entities`.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Метрика</label>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={metricId}
              onChange={(e) => setMetricId(e.target.value)}
              required
            >
              <option value="">Выберите…</option>
              {(metricsQuery.data ?? []).map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.metric_code}){m.unit ? `, ${m.unit}` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Значение</label>
            <Input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Время замера</label>
            <Input
              type="datetime-local"
              value={capturedAt}
              onChange={(e) => setCapturedAt(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending}>
            {pending ? 'Сохранение…' : 'Сохранить замер'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default function SensorsPage() {
  return (
    <>
      <Head>
        <title>Сенсоры — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Сенсоры">
          <SensorForm />
        </AppShell>
      </AppRouteReady>
    </>
  );
}
