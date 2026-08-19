import { describe, expect, it } from 'vitest';
import { localeFromSearchParams } from '@/lib/i18n/locale-persist';
import { isPublicI18nPath } from '@/lib/i18n/public-paths';

describe('locale-persist helpers', () => {
  it('parses ?lang= from search params with normalization', () => {
    expect(localeFromSearchParams('?lang=ru')).toBe('ru');
    expect(localeFromSearchParams('?lang=RU&x=1')).toBe('ru');
    expect(localeFromSearchParams('?lang=ua')).toBe('uk');
    expect(localeFromSearchParams('?lang=invalid')).toBeNull();
    expect(localeFromSearchParams('')).toBeNull();
  });
});

describe('public i18n paths', () => {
  it('matches public routes only', () => {
    expect(isPublicI18nPath('/')).toBe(true);
    expect(isPublicI18nPath('/auth/login')).toBe(true);
    expect(isPublicI18nPath('/onboarding')).toBe(true);
    expect(isPublicI18nPath('/dashboard')).toBe(false);
    expect(isPublicI18nPath('/log')).toBe(false);
  });
});
