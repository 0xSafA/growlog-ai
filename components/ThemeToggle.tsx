'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/components/providers/I18nProvider';

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="ml-2 w-10 h-10"
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      aria-label={t('theme.toggle')}
    >
      {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
    </Button>
  );
}