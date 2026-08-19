import { describe, expect, it } from 'vitest';
import {
  detectLocaleFromAcceptLanguage,
  detectLocaleFromNavigatorLanguages,
  determineLocale,
  mapLanguageTagToLocale,
  normalizeLocaleInput,
} from '@/lib/i18n/locale-detection';
import { DEFAULT_LOCALE } from '@/lib/i18n/locales';

describe('locale-detection', () => {
  it('maps language tags to supported locales', () => {
    expect(mapLanguageTagToLocale('ru-RU')).toBe('ru');
    expect(mapLanguageTagToLocale('zh-CN')).toBe('zh');
    expect(mapLanguageTagToLocale('xx')).toBeNull();
  });

  it('normalizes locale input', () => {
    expect(normalizeLocaleInput(' RU ')).toBe('ru');
    expect(normalizeLocaleInput('ua')).toBe('uk');
    expect(normalizeLocaleInput('xx')).toBeNull();
    expect(normalizeLocaleInput('')).toBeNull();
    expect(normalizeLocaleInput(null)).toBeNull();
  });

  it('parses Accept-Language with q-values', () => {
    expect(detectLocaleFromAcceptLanguage('ru-RU,ru;q=0.9,en;q=0.8')).toBe('ru');
    expect(detectLocaleFromAcceptLanguage('fr,en')).toBe('fr');
  });

  it('walks navigator.languages in order', () => {
    expect(detectLocaleFromNavigatorLanguages(['xx', 'de-DE', 'en'])).toBe('de');
  });

  it('determines locale by priority: query > cookie > accept > navigator', () => {
    expect(
      determineLocale({
        queryLocale: 'cs',
        cookieLocale: 'ru',
        acceptLanguage: 'fr',
        navigatorLanguages: ['de'],
      })
    ).toBe('cs');

    expect(
      determineLocale({
        cookieLocale: 'uk',
        acceptLanguage: 'fr',
      })
    ).toBe('uk');

    expect(
      determineLocale({
        acceptLanguage: 'es-ES,en',
      })
    ).toBe('es');

    expect(determineLocale({})).toBe(DEFAULT_LOCALE);
  });

  it('normalizes cookie locale casing via determineLocale', () => {
    expect(determineLocale({ cookieLocale: 'RU' })).toBe('ru');
  });
});
