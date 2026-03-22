import type { SupabaseClient } from '@supabase/supabase-js';
import type { ReportRow } from '@/types/report';

export async function fetchReportsForFarm(
  supabase: SupabaseClient,
  farmId: string,
  limit = 40
): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('farm_id', farmId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as ReportRow[];
}

export async function fetchReportById(
  supabase: SupabaseClient,
  farmId: string,
  reportId: string
): Promise<ReportRow | null> {
  const { data, error } = await supabase
    .from('reports')
    .select('*')
    .eq('farm_id', farmId)
    .eq('id', reportId)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as ReportRow) ?? null;
}
