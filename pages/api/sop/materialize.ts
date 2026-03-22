import type { NextApiRequest, NextApiResponse } from 'next';
import { createClient } from '@supabase/supabase-js';
import { getBearerToken, getUserFromBearer } from '@/lib/api/auth-from-request';
import { materializeSopRunsForDay } from '@/lib/growlog/sop-engine';

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

  const supabase = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const body = req.body as {
    farmId?: string;
    cycleId?: string;
    anchorDate?: string;
  };

  if (!body.farmId || !body.cycleId || !body.anchorDate) {
    return res.status(400).json({ error: 'missing_params' });
  }

  const anchorDate = body.anchorDate.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
    return res.status(400).json({ error: 'invalid_anchor_date' });
  }

  const { data: farm, error: farmErr } = await supabase
    .from('farms')
    .select('timezone')
    .eq('id', body.farmId)
    .single();
  if (farmErr || !farm) {
    return res.status(404).json({ error: 'farm_not_found' });
  }

  const tz = farm.timezone || 'UTC';

  try {
    const result = await materializeSopRunsForDay(supabase, {
      farmId: body.farmId,
      cycleId: body.cycleId,
      anchorDate,
      timezone: tz,
    });
    return res.status(200).json({
      created: result.created,
      skippedTriggers: result.skippedTriggers,
      skippedIneligible: result.skippedIneligible,
      evalNoMatch: result.evalNoMatch,
      overdueUpdated: result.overdueUpdated,
      complianceRefreshed: result.complianceRefreshed,
      anchorDate,
      timezone: tz,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'cycle_not_found') {
      return res.status(404).json({ error: 'cycle_not_found' });
    }
    return res.status(500).json({ error: 'materialize_failed', detail: msg });
  }
}
