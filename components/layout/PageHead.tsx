'use client';

import { useTranslation } from '@/components/providers/I18nProvider';
import { pageTitle } from '@/lib/i18n/translate';
import Head from 'next/head';

export function PageHead({ titleKey }: { titleKey: string }) {
  const { t } = useTranslation();
  return (
    <Head>
      <title>{pageTitle(t, titleKey)}</title>
    </Head>
  );
}
