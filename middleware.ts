import { determineLocale, normalizeLocaleInput } from '@/lib/i18n/locale-detection';
import {
  LOCALE_COOKIE_KEY,
  LOCALE_COOKIE_MAX_AGE_SECONDS,
} from '@/lib/i18n/locale-persist';
import { isPublicI18nPath } from '@/lib/i18n/public-paths';
import { updateSession } from '@/lib/supabase/middleware';
import { NextResponse, type NextRequest } from 'next/server';

function applyLocaleCookie(request: NextRequest, response: NextResponse, locale: string): void {
  response.cookies.set(LOCALE_COOKIE_KEY, locale, {
    path: '/',
    maxAge: LOCALE_COOKIE_MAX_AGE_SECONDS,
    sameSite: 'lax',
    secure: request.nextUrl.protocol === 'https:',
  });
}

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  const pathname = request.nextUrl.pathname;

  const queryLang = normalizeLocaleInput(request.nextUrl.searchParams.get('lang'));

  // ?lang= on any route (e.g. shared /dashboard?lang=ru)
  if (queryLang) {
    applyLocaleCookie(request, response, queryLang);
    return response;
  }

  if (!isPublicI18nPath(pathname)) {
    return response;
  }

  const existingCookie = normalizeLocaleInput(
    request.cookies.get(LOCALE_COOKIE_KEY)?.value
  );
  if (existingCookie) {
    // Normalize casing (RU → ru) in cookie
    const raw = request.cookies.get(LOCALE_COOKIE_KEY)?.value;
    if (raw && raw !== existingCookie) {
      applyLocaleCookie(request, response, existingCookie);
    }
    return response;
  }

  const detected = determineLocale({
    acceptLanguage: request.headers.get('accept-language'),
  });
  applyLocaleCookie(request, response, detected);

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
