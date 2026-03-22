import { createBrowserClient } from '@supabase/ssr';

/** Placeholders allow `next build` without local .env; set real values at runtime. */
const FALLBACK_URL = 'https://placeholder.local';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_KEY
  );
}
