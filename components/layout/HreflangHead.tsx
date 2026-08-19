import { DEFAULT_LOCALE, LOCALE_HREFLANG, LOCALES, type Locale } from '@/lib/i18n/locales';
import { publicPageUrl } from '@/lib/i18n/site-url';
import Head from 'next/head';

type Props = {
  path: string;
};

/** Server-safe hreflang + canonical for public routes. */
export function HreflangHead({ path }: Props) {
  const canonical = publicPageUrl(path, DEFAULT_LOCALE);

  return (
    <Head>
      <link rel="canonical" href={canonical} />
      {LOCALES.map((locale: Locale) => (
        <link
          key={locale}
          rel="alternate"
          hrefLang={LOCALE_HREFLANG[locale]}
          href={publicPageUrl(path, locale)}
        />
      ))}
      <link rel="alternate" hrefLang="x-default" href={canonical} />
    </Head>
  );
}
