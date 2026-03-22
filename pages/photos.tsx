'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { createPhotoCaptureEvent } from '@/lib/growlog/mutations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import Head from 'next/head';
import { useRef, useState } from 'react';

function PhotoForm() {
  const { supabase, farmId, cycle, primaryScope, refetchAll, userId } = useFarmContext();
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !farmId || !cycle || !primaryScope) return;
    setError(null);
    setPending(true);
    try {
      await createPhotoCaptureEvent(supabase, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        file,
        caption: caption.trim() || undefined,
        userId,
      });
      setCaption('');
      if (inputRef.current) inputRef.current.value = '';
      await refetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка загрузки');
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return <p className="text-muted-foreground">Нужен активный цикл.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Фото в журнал</CardTitle>
        <CardDescription>
          Файл уходит в Storage bucket `media`, создаётся `media_assets` и событие `photo_capture`
          (ADR-001).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Подпись (опционально)</label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Файл</label>
          <Input ref={inputRef} type="file" accept="image/*" onChange={onPick} disabled={pending} />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {pending && <p className="text-sm text-muted-foreground">Загрузка…</p>}
      </CardContent>
    </Card>
  );
}

export default function PhotosPage() {
  return (
    <>
      <Head>
        <title>Фото — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Фото">
          <PhotoForm />
        </AppShell>
      </AppRouteReady>
    </>
  );
}
