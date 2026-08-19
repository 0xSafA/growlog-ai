import { en } from '@/lib/i18n/messages/en';
import type { Messages } from '@/lib/i18n/types';

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in (cur as object)) {
      cur = (cur as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof cur === 'string' ? cur : undefined;
}

export type TranslateVars = Record<string, string | number>;

export function createTranslator(messages: Messages) {
  return function t(key: string, vars?: TranslateVars): string {
    let value = getNested(messages as Record<string, unknown>, key) ?? getNested(en as Record<string, unknown>, key) ?? key;
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        value = value.replaceAll(`{${k}}`, String(v));
      }
    }
    return value;
  };
}

export function pageTitle(t: (key: string) => string, key: string): string {
  return `${t(key)} — ${t('appName')}`;
}
