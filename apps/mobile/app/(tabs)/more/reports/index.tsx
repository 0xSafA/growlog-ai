import { useFarmContext } from '@/providers/FarmProvider';
import { anchorDateForTimezone } from '@/lib/sop-utils';
import { generateReport } from '@growlog/api-client';
import { fetchReportsForFarm, REPORT_TYPES } from '@growlog/domain';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function ReportsListScreen() {
  const { supabase, farmId, cycle, primaryScope, farms } = useFarmContext();
  const farm = farms.find((f) => f.id === farmId);
  const today = useMemo(
    () => anchorDateForTimezone(farm?.timezone ?? 'UTC'),
    [farm?.timezone]
  );

  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reportType, setReportType] = useState('daily');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const listQuery = useQuery({
    queryKey: ['reports', farmId],
    enabled: !!farmId,
    queryFn: () => fetchReportsForFarm(supabase, farmId!),
  });

  async function onGenerate() {
    if (!farmId || !cycle) return;
    setError(null);
    setBusy(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('Not signed in');
      const j = await generateReport(token, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope?.id ?? null,
        reportType,
        audienceType: 'internal_operational',
        outputFormat: 'html',
        startDate,
        endDate,
      });
      await listQuery.refetch();
      if (j.reportId) router.push(`/(tabs)/more/reports/${j.reportId}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Generate failed');
    } finally {
      setBusy(false);
    }
  }

  if (!cycle) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>An active cycle is required.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>New report</Text>
      <Text style={styles.label}>Type</Text>
      <View style={styles.chips}>
        {REPORT_TYPES.slice(0, 4).map((t) => (
          <Pressable
            key={t}
            style={[styles.chip, reportType === t && styles.chipActive]}
            onPress={() => setReportType(t)}
          >
            <Text style={[styles.chipText, reportType === t && styles.chipTextActive]}>{t}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={styles.label}>Start date (yyyy-mm-dd)</Text>
      <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} />
      <Text style={styles.label}>End date</Text>
      <TextInput style={styles.input} value={endDate} onChangeText={setEndDate} />
      <Pressable style={styles.btn} onPress={() => void onGenerate()} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Generate report</Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Text style={styles.section}>Recent</Text>
      {listQuery.isLoading && <ActivityIndicator color="#2d6a4f" />}
      {listQuery.data?.length === 0 && !listQuery.isLoading && (
        <Text style={styles.muted}>No reports yet.</Text>
      )}
      {listQuery.data?.map((r) => (
        <Pressable
          key={r.id}
          style={styles.reportRow}
          onPress={() => router.push(`/(tabs)/more/reports/${r.id}`)}
        >
          <Text style={styles.reportTitle}>{r.title}</Text>
          <Text style={styles.reportMeta}>
            {r.status} · {r.report_type}
          </Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 40 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: '#52796f',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    backgroundColor: '#fff',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#2d6a4f' },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#fff' },
  btn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnText: { color: '#fff', fontWeight: '600' },
  reportRow: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  reportTitle: { fontSize: 15, fontWeight: '600' },
  reportMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  error: { color: '#b91c1c' },
  muted: { color: '#6b7280' },
});
