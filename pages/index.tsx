import { AppRouteReady } from '@/components/AppRouteReady';
import { DailyFocus } from '@/components/daily-focus/DailyFocus';
import { AppShell } from '@/components/layout/AppShell';
import Head from 'next/head';

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Фокус дня — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Фокус дня">
          <DailyFocus />
        </AppShell>
      </AppRouteReady>
    </>
  );
}
