/** Routes where middleware may seed locale cookie and hreflang applies. */
export function isPublicI18nPath(pathname: string): boolean {
  return (
    pathname === '/' ||
    pathname === '/auth/login' ||
    pathname.startsWith('/auth/login') ||
    pathname === '/onboarding'
  );
}
