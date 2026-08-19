'use client';

import { PageHead } from '@/components/layout/PageHead';
import { useTranslation } from '@/components/providers/I18nProvider';
import Head from 'next/head';

export function HomeHead() {
  const { t } = useTranslation();
  return (
    <>
      <PageHead titleKey="titles.home" />
      <Head>
        <meta name="description" content={t('landing.heroSubtitle')} />
      </Head>
    </>
  );
}
