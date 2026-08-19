import { DEFAULT_LOCALE, isLocale, type Locale } from '@/lib/i18n/locales';

/** Normalize user-facing locale input (query, cookie, storage). */
export function normalizeLocaleInput(value: string | null | undefined): Locale | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const lower = trimmed.toLowerCase();
  // Some browsers / links use ua instead of uk
  if (lower === 'ua') return 'uk';
  return isLocale(lower) ? lower : null;
}

/** Map BCP-47 tag to a supported locale, or null. Edge-safe. */
export function mapLanguageTagToLocale(tag: string): Locale | null {
  const normalized = tag.trim().toLowerCase();
  if (!normalized) return null;

  const alias = normalizeLocaleInput(normalized);
  if (alias) return alias;

  const code = normalized.split('-')[0];
  if (code === 'zh') return 'zh';
  if (isLocale(code)) return code;

  return null;
}

/**
 * Parse Accept-Language (e.g. "ru-RU,ru;q=0.9,en;q=0.8") with q-values.
 * Edge-safe — used in middleware.
 */
export function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null | undefined
): Locale | null {
  if (!acceptLanguage) return null;

  const languages = acceptLanguage
    .split(',')
    .map((part) => {
      const [locale, qPart = 'q=1'] = part.trim().split(';');
      const quality = Number.parseFloat(qPart.replace(/^q=/, '')) || 1;
      return { locale: locale.trim(), quality };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const { locale } of languages) {
    const mapped = mapLanguageTagToLocale(locale);
    if (mapped) return mapped;
  }

  return null;
}

/** Client-side: walk navigator.languages (fallback to navigator.language). */
export function detectLocaleFromNavigatorLanguages(
  languages: readonly string[] | undefined
): Locale | null {
  if (!languages?.length) return null;

  for (const tag of languages) {
    const mapped = mapLanguageTagToLocale(tag);
    if (mapped) return mapped;
  }

  return null;
}

export function getLocaleFromCookieValue(cookieValue: string | undefined | null): Locale | null {
  return normalizeLocaleInput(cookieValue ?? undefined);
}

/**
 * Priority: explicit query/cookie → Accept-Language / navigator → default.
 * Pass only the signals available in the current runtime.
 */
export function determineLocale(params: {
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
  navigatorLanguages?: readonly string[];
  queryLocale?: string | null;
}): Locale {
  const fromQuery = getLocaleFromCookieValue(params.queryLocale ?? undefined);
  if (fromQuery) return fromQuery;

  const fromCookie = getLocaleFromCookieValue(params.cookieLocale ?? undefined);
  if (fromCookie) return fromCookie;

  const fromAccept = detectLocaleFromAcceptLanguage(params.acceptLanguage ?? null);
  if (fromAccept) return fromAccept;

  const fromNavigator = detectLocaleFromNavigatorLanguages(params.navigatorLanguages);
  if (fromNavigator) return fromNavigator;

  return DEFAULT_LOCALE;
}
