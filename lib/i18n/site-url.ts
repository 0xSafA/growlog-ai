/** Canonical site origin for hreflang and share links. */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, '');

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, '')}`;

  return 'http://localhost:3000';
}

/** Public page URL with optional ?lang= for non-default locales (hreflang + sharing). */
export function publicPageUrl(path: string, locale: string, defaultLocale = 'en'): string {
  const base = getSiteUrl();
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const url = `${base}${normalized}`;
  if (locale === defaultLocale) return url;
  const separator = normalized.includes('?') ? '&' : '?';
  return `${url}${separator}lang=${locale}`;
}
