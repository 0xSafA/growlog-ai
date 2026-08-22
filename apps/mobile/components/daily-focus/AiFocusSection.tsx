import { AiFocusCard } from '@/components/daily-focus/AiFocusCard';
import { fetchDailyFocusInsights, type DailyFocusInsightRow } from '@growlog/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  supabase: SupabaseClient;
  farmId: string;
  cycleId: string;
  enabled?: boolean;
};

export function AiFocusSection({ supabase, farmId, cycleId, enabled = true }: Props) {
  const insightsQuery = useQuery({
    queryKey: ['ai-insights-daily-focus', farmId, cycleId],
    enabled: enabled && !!farmId && !!cycleId,
    queryFn: (): Promise<DailyFocusInsightRow[]> =>
      fetchDailyFocusInsights(supabase, { farmId, cycleId, limit: 8 }),
  });

  const insights = insightsQuery.isError ? [] : (insightsQuery.data ?? []);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>AI Focus</Text>
      <Text style={styles.sectionDesc}>
        Prioritized insights from your farm data — always verify before acting.
      </Text>

      {insightsQuery.isLoading && (
        <ActivityIndicator color="#2d6a4f" style={{ marginVertical: 12 }} />
      )}

      {insightsQuery.isError && (
        <Text style={styles.error}>Could not load insights. Pull to refresh later.</Text>
      )}

      {!insightsQuery.isLoading && !insightsQuery.isError && insights.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>No AI insights yet for this cycle.</Text>
          <Text style={styles.emptyHint}>
            Log observations, run SOPs, or ask the Assistant to generate focus cards.
          </Text>
          <Pressable style={styles.emptyBtn} onPress={() => router.push('/(tabs)/assistant')}>
            <Text style={styles.emptyBtnText}>Open Assistant</Text>
          </Pressable>
        </View>
      )}

      {insights.map((insight) => (
        <AiFocusCard
          key={insight.id}
          insight={insight}
          supabase={supabase}
          onOpenAssistant={() => router.push('/(tabs)/assistant')}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d8ead9',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#52796f',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  sectionDesc: { fontSize: 13, color: '#6b7280', marginBottom: 12, lineHeight: 18 },
  error: { fontSize: 14, color: '#b91c1c', marginVertical: 8 },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  emptyText: { fontSize: 14, fontWeight: '600', color: '#374151', textAlign: 'center' },
  emptyHint: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyBtn: {
    marginTop: 12,
    backgroundColor: '#2d6a4f',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  emptyBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
