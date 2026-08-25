import { AiFocusSection } from '@/components/daily-focus/AiFocusSection';
import { useFarmContext } from '@/providers/FarmProvider';
import { anchorDateForTimezone, sopRunTitle } from '@/lib/sop-utils';
import { fetchOpenSopRuns, SOP_RUNS_QUERY_KEY } from '@growlog/domain';
import { materializeSopRuns } from '@growlog/api-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';

const RISK_TYPES = ['issue_detected', 'pest_detected', 'deficiency_suspected', 'anomaly'];

export default function DailyFocusScreen() {
  const { supabase, farmId, cycle, farms, todayEvents, recentEvents, loading, primaryScope, refetchAll } =
    useFarmContext();
  const farm = farms.find((f) => f.id === farmId);
  const [refreshing, setRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const sopRunsQuery = useQuery({
    queryKey: [SOP_RUNS_QUERY_KEY, farmId, cycle?.id, 'daily-focus'],
    enabled: !!farmId && !!cycle?.id && !!farm && !loading,
    queryFn: async () => {
      const anchorDate = anchorDateForTimezone(farm?.timezone ?? 'UTC');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return [];
      await materializeSopRuns(token, {
        farmId: farmId!,
        cycleId: cycle!.id,
        anchorDate,
      }).catch(() => undefined);
      return fetchOpenSopRuns(supabase, { farmId: farmId!, cycleId: cycle!.id });
    },
  });

  const onRefresh = useCallback(async () => {
    if (!farmId || !cycle?.id) return;
    setRefreshing(true);
    try {
      await Promise.all([
        sopRunsQuery.refetch(),
        queryClient.refetchQueries({ queryKey: ['ai-insights-daily-focus', farmId, cycle.id] }),
        Promise.resolve(refetchAll()),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [sopRunsQuery, queryClient, farmId, cycle?.id, refetchAll]);

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (!cycle || !primaryScope || !farmId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Complete onboarding first.</Text>
      </View>
    );
  }

  const dayNumber = Math.max(
    1,
    Math.ceil((Date.now() - new Date(cycle.start_date).getTime()) / (1000 * 60 * 60 * 24))
  );

  const risks = recentEvents.filter((e) => RISK_TYPES.includes(e.event_type));
  const sopRuns = sopRunsQuery.data ?? [];

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <View style={[styles.card, styles.snapshotCard]}>
        <Text style={styles.snapshotLabel}>Key snapshot</Text>
        <Text style={styles.snapshotTitle}>{cycle.name}</Text>
        <Text style={styles.snapshotMeta}>
          Day {dayNumber} · {cycle.stage}
          {cycle.cultivar_name ? ` · ${cycle.cultivar_name}` : ''}
        </Text>
        <Text style={styles.snapshotEvents}>
          {todayEvents.length} events logged today
        </Text>
      </View>

      <View style={[styles.card, risks.length > 0 && styles.riskCard]}>
        <Text style={styles.cardTitle}>Alerts & risks</Text>
        {risks.length === 0 ? (
          <Text style={styles.muted}>No recent risk signals.</Text>
        ) : (
          risks.slice(0, 5).map((e) => (
            <View key={e.id} style={styles.riskRow}>
              <Text style={styles.riskType}>{e.event_type.replace(/_/g, ' ')}</Text>
              {e.body ? <Text style={styles.cardBody}>{e.body}</Text> : null}
            </View>
          ))
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today SOP</Text>
        {sopRunsQuery.isLoading && <Text style={styles.muted}>Loading tasks…</Text>}
        {sopRuns.length === 0 && !sopRunsQuery.isLoading && (
          <>
            <Text style={styles.muted}>No open SOP runs for today.</Text>
            <Pressable onPress={() => router.push('/sop/new')}>
              <Text style={styles.link}>Create a SOP</Text>
            </Pressable>
          </>
        )}
        {sopRuns.slice(0, 4).map((r) => (
          <Pressable
            key={r.id}
            style={styles.sopRow}
            onPress={() => router.push(`/sop/run/${r.id}`)}
          >
            <Text style={styles.sopTitle}>
              {sopRunTitle(r)}
              {r.status === 'overdue' ? ' · overdue' : ''}
            </Text>
            <Text style={styles.sopMeta}>{r.status}</Text>
          </Pressable>
        ))}
        {sopRuns.length > 4 && (
          <Pressable onPress={() => router.push('/(tabs)/sop')}>
            <Text style={styles.link}>View all SOP</Text>
          </Pressable>
        )}
      </View>

      <AiFocusSection supabase={supabase} farmId={farmId} cycleId={cycle.id} />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick actions</Text>
        <View style={styles.quickRow}>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/capture/voice')}>
            <Text style={styles.quickBtnText}>Voice</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/(tabs)/more/photos')}>
            <Text style={styles.quickBtnText}>Photo</Text>
          </Pressable>
          <Pressable style={styles.quickBtn} onPress={() => router.push('/capture/sensor')}>
            <Text style={styles.quickBtnText}>Sensor</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent</Text>
        {recentEvents.length === 0 ? (
          <Text style={styles.muted}>No events yet. Tap Log to capture your first entry.</Text>
        ) : (
          recentEvents.slice(0, 6).map((e) => (
            <Text key={e.id} style={styles.eventRow}>
              {e.event_type.replace(/_/g, ' ')}: {e.body?.slice(0, 60) ?? '—'}
            </Text>
          ))
        )}
        <Pressable onPress={() => router.push('/(tabs)/timeline')}>
          <Text style={styles.link}>Full timeline</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 120, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d8ead9',
  },
  snapshotCard: { backgroundColor: '#f0fdf4', borderColor: '#86efac' },
  snapshotLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#52796f',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  snapshotTitle: { fontSize: 20, fontWeight: '700', color: '#1b4332' },
  snapshotMeta: { fontSize: 14, color: '#52796f', marginTop: 4 },
  snapshotEvents: { fontSize: 13, color: '#6b7280', marginTop: 8 },
  riskCard: { borderColor: '#fbbf24', backgroundColor: '#fffbeb' },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#52796f',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  cardBody: { fontSize: 14, color: '#1f2937', lineHeight: 20, marginTop: 4 },
  riskRow: {
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#fde68a',
  },
  riskType: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b45309',
    textTransform: 'uppercase',
  },
  sopRow: {
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  sopTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  sopMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  eventRow: { fontSize: 14, color: '#374151', marginBottom: 6, lineHeight: 20 },
  muted: { color: '#6b7280', fontSize: 14 },
  link: { fontSize: 13, fontWeight: '600', color: '#2d6a4f', marginTop: 8 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    backgroundColor: '#ecfdf5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#a7f3d0',
  },
  quickBtnText: { fontSize: 13, fontWeight: '600', color: '#065f46' },
});
