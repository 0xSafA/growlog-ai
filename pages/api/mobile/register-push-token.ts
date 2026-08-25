import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getBearerToken, getUserFromBearer } from '@/lib/api/auth-from-request';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authError } = await getUserFromBearer(req);
  if (!user || authError) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'unauthorized' });

  const body = req.body as {
    expoPushToken?: string;
    platform?: string;
    deviceLabel?: string;
  };

  const expoPushToken = typeof body.expoPushToken === 'string' ? body.expoPushToken.trim() : '';
  if (!expoPushToken) {
    return res.status(400).json({ error: 'missing_expo_push_token' });
  }

  const platformRaw = typeof body.platform === 'string' ? body.platform.toLowerCase() : 'unknown';
  const platform =
    platformRaw === 'ios' || platformRaw === 'android' ? platformRaw : ('unknown' as const);

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { error } = await supabase.from('mobile_push_tokens').upsert(
    {
      user_id: user.id,
      expo_push_token: expoPushToken,
      platform,
      device_label: body.deviceLabel?.trim() || null,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,expo_push_token' }
  );

  if (error) {
    return res.status(500).json({ error: 'upsert_failed', detail: error.message });
  }

  return res.status(200).json({ ok: true });
}
