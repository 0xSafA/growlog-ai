import type { NextApiRequest } from 'next';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export function getBearerToken(req: NextApiRequest): string | null {
  const raw = req.headers.authorization;
  if (!raw || !raw.startsWith('Bearer ')) return null;
  return raw.slice(7).trim() || null;
}

export async function getUserFromBearer(req: NextApiRequest) {
  const token = getBearerToken(req);
  if (!token) {
    return { user: null as null, error: 'missing_authorization' as const };
  }
  const supabase = createClient(url, anon);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return { user: null as null, error: 'invalid_session' as const };
  }
  return { user: data.user, error: null as null };
}
