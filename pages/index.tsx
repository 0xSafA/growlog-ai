import { AppRouteReady } from '@/components/AppRouteReady';
import { DailyFocus } from '@/components/daily-focus/DailyFocus';
import { AppShell } from '@/components/layout/AppShell';
import Head from 'next/head';

export default function HomePage() {
  return (
    <>
      <Head>
        <title>Daily Focus — Growlog AI</title>
      </Head>
      <AppRouteReady>
        <AppShell title="Daily Focus">
          <DailyFocus />
        </AppShell>
      </AppRouteReady>
    </>
  );
}
