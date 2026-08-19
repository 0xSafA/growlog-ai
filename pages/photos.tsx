'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { PageHead } from '@/components/layout/PageHead';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import {
  formatPhotoSizeLimit,
  getMaxPhotoBytesVisionClient,
} from '@/lib/growlog/photo-constants';
import { createPhotoCaptureEvent } from '@/lib/growlog/mutations';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useRef, useState } from 'react';

function PhotoForm() {
  const { t } = useTranslation();
  const { supabase, farmId, cycle, primaryScope, refetchAll, userId } = useFarmContext();
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const maxBytes = getMaxPhotoBytesVisionClient();

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !farmId || !cycle || !primaryScope) return;
    setError(null);
    if (file.size > maxBytes) {
      setError(
        t('photos.fileTooLarge', {
          size: formatPhotoSizeLimit(file.size),
          max: formatPhotoSizeLimit(maxBytes),
        })
      );
      e.target.value = '';
      return;
    }
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
      setError(err instanceof Error ? err.message : t('common.uploadError'));
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return <p className="text-muted-foreground">{t('common.needActiveCycle')}</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('photos.title')}</CardTitle>
        <CardDescription>{t('photos.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('photos.caption')}</label>
          <Input value={caption} onChange={(e) => setCaption(e.target.value)} />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">{t('photos.file')}</label>
          <Input ref={inputRef} type="file" accept="image/*" onChange={onPick} disabled={pending} />
          <p className="text-xs text-muted-foreground">
            {t('photos.sizeHint', { max: formatPhotoSizeLimit(maxBytes) })}
          </p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {pending && <p className="text-sm text-muted-foreground">{t('photos.uploading')}</p>}
      </CardContent>
    </Card>
  );
}

function PhotosPageBody() {
  const { t } = useTranslation();
  return (
    <>
      <PageHead titleKey="titles.photos" />
      <AppShell title={t('titles.photos')}>
        <PhotoForm />
      </AppShell>
    </>
  );
}

export default function PhotosPage() {
  return (
    <AppRouteReady>
      <PhotosPageBody />
    </AppRouteReady>
  );
}
