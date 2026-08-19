'use client';

import { useTranslation } from '@/components/providers/I18nProvider';
import { LOCALE_LABELS, LOCALES, type Locale } from '@/lib/i18n/locales';
import { cn } from '@/lib/utils';

type Props = {
  className?: string;
  compact?: boolean;
};

export function LanguageSwitcher({ className, compact }: Props) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <label className={cn('inline-flex items-center gap-1.5', className)}>
      {!compact && (
        <span className="sr-only">{t('language.label')}</span>
      )}
      <select
        className={cn(
          'rounded-md border border-input bg-background text-sm',
          compact ? 'h-8 px-2 text-xs max-w-[7rem]' : 'h-9 px-2'
        )}
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        aria-label={t('language.label')}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
