'use client';

import { useTranslation } from '@/components/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { normalizeLocaleInput } from '@/lib/i18n/locale-detection';
import { LOCALE_LABELS, LOCALES } from '@/lib/i18n/locales';
import { cn } from '@/lib/utils';
import { Globe } from 'lucide-react';

type Props = {
  className?: string;
};

export function LanguageSwitcher({ className }: Props) {
  const { locale, setLocale, t } = useTranslation();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn('h-9 w-9 shrink-0', className)}
          aria-label={t('language.label')}
          title={LOCALE_LABELS[locale]}
        >
          <Globe className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-[min(20rem,70vh)] overflow-y-auto">
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value) => {
            const next = normalizeLocaleInput(value);
            if (next) setLocale(next);
          }}
        >
          {LOCALES.map((code) => (
            <DropdownMenuRadioItem key={code} value={code}>
              {LOCALE_LABELS[code]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
