import type { Locale } from '@/lib/i18n/locales';
import type { Messages } from '@/lib/i18n/types';
import { en } from './en';
import { fr } from './fr';
import { de } from './de';
import { es } from './es';
import { ru } from './ru';
import { uk } from './uk';
import { cs } from './cs';
import { nl } from './nl';
import { zh } from './zh';

export const messagesByLocale: Record<Locale, Messages> = {
  en, fr, de, es, ru, uk, cs, nl, zh,
};
