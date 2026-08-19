'use client';

import { AdvisorChat } from '@/components/assistant/AdvisorChat';
import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { PageHead } from '@/components/layout/PageHead';
import { useTranslation } from '@/components/providers/I18nProvider';

function AssistantBody() {
  const { t } = useTranslation();
  return (
    <>
      <PageHead titleKey="titles.assistant" />
      <AppShell title={t('titles.assistant')}>
        <AdvisorChat />
      </AppShell>
    </>
  );
}

export default function AssistantPage() {
  return (
    <AppRouteReady>
      <AssistantBody />
    </AppRouteReady>
  );
}
