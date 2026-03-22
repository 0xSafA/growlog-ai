import { AdvisorChat } from '@/components/assistant/AdvisorChat';
import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import Head from 'next/head';

export default function AssistantPage() {
  return (
    <>
      <Head>
        <title>Ассистент — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Ассистент">
          <AdvisorChat />
        </AppShell>
      </AppRouteReady>
    </>
  );
}
