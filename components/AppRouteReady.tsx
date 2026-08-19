'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { useRouter } from 'next/router';
import { useEffect } from 'react';

/** Requires session and at least one farm; otherwise redirects to login / onboarding. */
export function AppRouteReady({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { t } = useTranslation();
  const { authLoading, userId, farmListReady, farms } = useFarmContext();

  useEffect(() => {
    if (authLoading) return;
    if (!userId) {
      void router.replace('/auth/login');
      return;
    }
    if (!farmListReady) return;
    if (farms.length === 0) {
      void router.replace('/onboarding');
    }
  }, [authLoading, userId, farmListReady, farms.length, router]);

  if (authLoading || !userId || !farmListReady) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t('common.loading')}
      </div>
    );
  }

  if (farms.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        {t('common.redirecting')}
      </div>
    );
  }

  return <>{children}</>;
}
