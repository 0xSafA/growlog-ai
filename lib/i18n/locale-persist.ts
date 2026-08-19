import { determineLocale, normalizeLocaleInput } from '@/lib/i18n/locale-detection';
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE_KEY,
  LOCALE_STORAGE_KEY,
  type Locale,
} from '@/lib/i18n/locales';

export { LOCALE_COOKIE_KEY, LOCALE_STORAGE_KEY };

export const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

function cookieSecureSuffix(): string {
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    return '; Secure';
  }
  return '';
}

export function localeCookieHeaderValue(locale: Locale): string {
  return `${LOCALE_COOKIE_KEY}=${encodeURIComponent(locale)}; Path=/; Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${cookieSecureSuffix()}`;
}

export function clearLocaleCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${LOCALE_COOKIE_KEY}=; Path=/; Max-Age=0; SameSite=Lax${cookieSecureSuffix()}`;
}

/** Read locale from document.cookie (client only). Clears invalid cookie values. */
export function readLocaleFromDocumentCookie(): Locale | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${LOCALE_COOKIE_KEY}=([^;]*)`)
  );
  const raw = match?.[1] ? decodeURIComponent(match[1]) : null;
  const normalized = normalizeLocaleInput(raw);
  if (raw && !normalized) {
    clearLocaleCookie();
  }
  return normalized;
}

/** Read locale from localStorage (client only). Removes invalid entries. */
export function readLocaleFromLocalStorage(): Locale | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (!stored) return null;
    const normalized = normalizeLocaleInput(stored);
    if (!normalized) {
      localStorage.removeItem(LOCALE_STORAGE_KEY);
      return null;
    }
    return normalized;
  } catch {
    return null;
  }
}

/** Resolve locale on the client; optionally persist first-time detection. */
export function resolveClientLocale(options?: { persistIfMissing?: boolean }): Locale {
  const persist = options?.persistIfMissing ?? true;

  const fromCookie = readLocaleFromDocumentCookie();
  const fromStorage = readLocaleFromLocalStorage();
  const navigatorLanguages =
    typeof navigator !== 'undefined'
      ? navigator.languages?.length
        ? [...navigator.languages]
        : [navigator.language]
      : undefined;

  let resolved: Locale;

  if (fromCookie && fromStorage && fromCookie !== fromStorage) {
    // Cookie wins (middleware / latest server signal); keep stores aligned.
    resolved = fromCookie;
    if (persist) persistClientLocale(resolved);
  } else {
    resolved = determineLocale({
      cookieLocale: fromCookie ?? fromStorage,
      navigatorLanguages,
    });

    if (persist && !fromCookie && !fromStorage) {
      persistClientLocale(resolved);
    } else if (persist && fromCookie && !fromStorage) {
      persistClientLocale(fromCookie);
    } else if (persist && fromStorage && !fromCookie) {
      persistClientLocale(fromStorage);
    }
  }

  return resolved;
}

/** Write locale to cookie + localStorage (client only). */
export function persistClientLocale(locale: Locale): void {
  if (typeof document !== 'undefined') {
    document.cookie = localeCookieHeaderValue(locale);
  }
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      /* ignore — cookie remains source of truth */
    }
  }
}

export function getServerFallbackLocale(): Locale {
  return DEFAULT_LOCALE;
}

/** Apply ?lang= from a URL search string; returns locale if applied. */
export function localeFromSearchParams(search: string): Locale | null {
  const lang = normalizeLocaleInput(new URLSearchParams(search).get('lang'));
  return lang;
}
