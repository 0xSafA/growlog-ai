'use client';

import { DailyFocus } from '@/components/daily-focus/DailyFocus';
import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { PageHead } from '@/components/layout/PageHead';
import { useTranslation } from '@/components/providers/I18nProvider';

function DashboardBody() {
  const { t } = useTranslation();
  return (
    <>
      <PageHead titleKey="titles.dashboard" />
      <AppShell title={t('titles.dashboard')}>
        <DailyFocus />
      </AppShell>
    </>
  );
}

export default function DashboardPage() {
  return (
    <AppRouteReady>
      <DashboardBody />
    </AppRouteReady>
  );
}
