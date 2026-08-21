import { useFarmContext } from '@/providers/FarmProvider';
import { anchorDateForTimezone, sopRunTitle } from '@/lib/sop-utils';
import {
  fetchOpenSopRuns,
  fetchSopDefinitions,
  SOP_RUNS_QUERY_KEY,
} from '@growlog/domain';
import { materializeSopRuns } from '@growlog/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

export default function SopScreen() {
  const { supabase, farmId, cycle, farms } = useFarmContext();
  const farm = farms.find((f) => f.id === farmId);

  const defsQuery = useQuery({
    queryKey: ['sop-definitions', farmId],
    enabled: !!farmId,
    queryFn: () => fetchSopDefinitions(supabase, farmId!),
  });

  const runsQuery = useQuery({
    queryKey: [SOP_RUNS_QUERY_KEY, farmId, cycle?.id],
    enabled: !!farmId && !!cycle?.id && !!farm,
    queryFn: async () => {
      const anchorDate = anchorDateForTimezone(farm?.timezone ?? 'UTC');
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');
      await materializeSopRuns(token, {
        farmId: farmId!,
        cycleId: cycle!.id,
        anchorDate,
      });
      return fetchOpenSopRuns(supabase, { farmId: farmId!, cycleId: cycle!.id });
    },
  });

  if (!cycle) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>An active grow cycle is required.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>Execute procedures and track compliance.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Active runs</Text>
        {runsQuery.isLoading && <ActivityIndicator color="#2d6a4f" style={{ marginTop: 8 }} />}
        {runsQuery.error && (
          <Text style={styles.error}>{(runsQuery.error as Error).message}</Text>
        )}
        {runsQuery.data?.length === 0 && !runsQuery.isLoading && (
          <Text style={styles.muted}>No open SOP runs for today.</Text>
        )}
        {runsQuery.data?.map((r) => {
          const title = sopRunTitle(r);
          const dueLabel = r.due_at
            ? new Date(r.due_at).toLocaleString(undefined, {
                dateStyle: 'short',
                timeStyle: 'short',
              })
            : null;
          return (
            <View key={r.id} style={styles.runRow}>
              <View style={styles.runInfo}>
                <Text style={styles.runTitle}>{title}</Text>
                <Text style={styles.runMeta}>
                  {r.status}
                  {dueLabel ? ` · due ${dueLabel}` : ''}
                </Text>
              </View>
              <Pressable
                style={styles.execBtn}
                onPress={() => router.push(`/sop/run/${r.id}`)}
              >
                <Text style={styles.execBtnText}>Execute</Text>
              </Pressable>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Definitions</Text>
        {defsQuery.isLoading && <ActivityIndicator color="#2d6a4f" style={{ marginTop: 8 }} />}
        {defsQuery.data?.length === 0 && !defsQuery.isLoading && (
          <Text style={styles.muted}>No SOP definitions yet.</Text>
        )}
        {defsQuery.data?.map((d) => (
          <View key={d.id} style={styles.defRow}>
            <Text style={styles.defTitle}>{d.title}</Text>
            {d.description ? <Text style={styles.defDesc}>{d.description}</Text> : null}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 120 },
  intro: { fontSize: 14, color: '#52796f', marginBottom: 16 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d8ead9',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#52796f',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  runInfo: { flex: 1 },
  runTitle: { fontSize: 15, fontWeight: '600', color: '#1f2937' },
  runMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  execBtn: {
    backgroundColor: '#40916c',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  execBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
  defRow: { paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  defTitle: { fontSize: 15, fontWeight: '600' },
  defDesc: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  muted: { fontSize: 14, color: '#6b7280' },
  error: { fontSize: 14, color: '#b91c1c', marginTop: 8 },
});
