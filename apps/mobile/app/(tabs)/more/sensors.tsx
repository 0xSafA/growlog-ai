import { useFarmContext } from '@/providers/FarmProvider';
import { createManualSensorReading, fetchGlobalSensorMetrics } from '@growlog/domain';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function SensorsScreen() {
  const { supabase, farmId, cycle, primaryScope, refetchAll, userId } = useFarmContext();
  const metricsQuery = useQuery({
    queryKey: ['sensor-metrics-global'],
    queryFn: () => fetchGlobalSensorMetrics(supabase),
  });

  const [metricId, setMetricId] = useState('');
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!farmId || !cycle || !primaryScope || !metricId) return;
    const m = metricsQuery.data?.find((x) => x.id === metricId);
    setError(null);
    setMsg(null);
    setPending(true);
    try {
      const num = parseFloat(value.replace(',', '.'));
      if (Number.isNaN(num)) throw new Error('Enter a valid number');
      await createManualSensorReading(supabase, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        metricId,
        value: num,
        capturedAt: new Date().toISOString(),
        unit: m?.unit ?? null,
        userId,
      });
      setValue('');
      await refetchAll();
      setMsg('Reading saved.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>An active cycle is required.</Text>
      </View>
    );
  }

  if (metricsQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2d6a4f" />
      </View>
    );
  }

  const metrics = metricsQuery.data ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.label}>Metric</Text>
      {metrics.map((m) => (
        <Pressable
          key={m.id}
          style={[styles.metricRow, metricId === m.id && styles.metricActive]}
          onPress={() => setMetricId(m.id)}
        >
          <Text style={styles.metricName}>
            {m.name} ({m.metric_code}){m.unit ? `, ${m.unit}` : ''}
          </Text>
        </Pressable>
      ))}

      <Text style={styles.label}>Value</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={value}
        onChangeText={setValue}
        placeholder="e.g. 6.2"
      />

      <Pressable
        style={[styles.btn, (pending || !metricId) && styles.btnDisabled]}
        onPress={() => void submit()}
        disabled={pending || !metricId}
      >
        <Text style={styles.btnText}>{pending ? 'Saving…' : 'Save reading'}</Text>
      </Pressable>

      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 14, fontWeight: '600', marginTop: 12, marginBottom: 8, color: '#374151' },
  metricRow: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  metricActive: { borderColor: '#2d6a4f', backgroundColor: '#f0fdf4' },
  metricName: { fontSize: 15, color: '#1f2937' },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  btn: {
    marginTop: 16,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  ok: { color: '#166534', marginTop: 12 },
  error: { color: '#b91c1c', marginTop: 12 },
  muted: { color: '#6b7280' },
});
