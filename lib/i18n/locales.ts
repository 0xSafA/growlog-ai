export const LOCALES = ['en', 'fr', 'de', 'es', 'ru', 'uk', 'cs', 'nl', 'zh'] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_STORAGE_KEY = 'growlog_locale';

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  ru: 'Русский',
  uk: 'Українська',
  cs: 'Čeština',
  nl: 'Nederlands',
  zh: '中文',
};

/** Map browser language tag to supported locale. */
export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const tag = (navigator.language || 'en').toLowerCase();
  if (tag.startsWith('zh')) return 'zh';
  if (tag.startsWith('uk')) return 'uk';
  if (tag.startsWith('ru')) return 'ru';
  if (tag.startsWith('fr')) return 'fr';
  if (tag.startsWith('de')) return 'de';
  if (tag.startsWith('es')) return 'es';
  if (tag.startsWith('cs')) return 'cs';
  if (tag.startsWith('nl')) return 'nl';
  return 'en';
}

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
