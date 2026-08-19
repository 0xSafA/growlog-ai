'use client';

import { normalizeLocaleInput } from '@/lib/i18n/locale-detection';
import {
  persistClientLocale,
  resolveClientLocale,
} from '@/lib/i18n/locale-persist';
import { messagesByLocale } from '@/lib/i18n/messages';
import { DEFAULT_LOCALE, type Locale } from '@/lib/i18n/locales';
import { createTranslator, type TranslateVars } from '@/lib/i18n/translate';
import { useRouter } from 'next/router';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: TranslateVars) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

function stripLangQueryFromUrl(): Locale | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const raw = params.get('lang');
  if (!raw) return null;

  const lang = normalizeLocaleInput(raw);

  if (window.history.replaceState) {
    params.delete('lang');
    const qs = params.toString();
    const next =
      window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    window.history.replaceState({}, '', next);
  }

  if (lang) persistClientLocale(lang);
  return lang;
}

function readInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  return stripLangQueryFromUrl() ?? resolveClientLocale({ persistIfMissing: false });
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [locale, setLocaleState] = useState<Locale>(readInitialLocale);

  useEffect(() => {
    const resolved = resolveClientLocale({ persistIfMissing: true });
    setLocaleState(resolved);
    document.documentElement.lang = resolved;
  }, []);

  // Client navigations to ?lang= on any route (incl. protected)
  useEffect(() => {
    if (!router.isReady) return;

    const raw = router.query.lang;
    if (typeof raw !== 'string') return;

    const lang = normalizeLocaleInput(raw);

    const { lang: _removed, ...rest } = router.query;
    void router.replace({ pathname: router.pathname, query: rest }, undefined, {
      shallow: true,
    });

    if (!lang) return;

    setLocaleState(lang);
    persistClientLocale(lang);
    document.documentElement.lang = lang;
  }, [router, router.isReady, router.pathname, router.query.lang]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    persistClientLocale(next);
    document.documentElement.lang = next;
  }, []);

  const t = useMemo(() => createTranslator(messagesByLocale[locale]), [locale]);

  const value = useMemo(
    () => ({ locale, setLocale, t }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useTranslation must be used within I18nProvider');
  }
  return ctx;
}
