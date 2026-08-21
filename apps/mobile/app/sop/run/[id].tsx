import { useFarmContext } from '@/providers/FarmProvider';
import { sopRunTitle } from '@/lib/sop-utils';
import {
  executeSopRun,
  fetchSopRunById,
  parseRequiredInputKeys,
  SOP_RUNS_QUERY_KEY,
} from '@growlog/domain';
import type { SopExecutionStatus } from '@growlog/domain';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const STATUSES: { value: SopExecutionStatus; label: string }[] = [
  { value: 'done', label: 'Done' },
  { value: 'delayed', label: 'Delayed' },
  { value: 'partially_done', label: 'Partially done' },
  { value: 'skipped', label: 'Skipped' },
  { value: 'blocked', label: 'Blocked' },
];

export default function SopRunScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const runId = typeof id === 'string' ? id : '';
  const queryClient = useQueryClient();
  const { supabase, farmId, cycle, primaryScope, userId } = useFarmContext();

  const [executionStatus, setExecutionStatus] = useState<SopExecutionStatus>('done');
  const [notes, setNotes] = useState('');
  const [measuredFields, setMeasuredFields] = useState<Record<string, string>>({});
  const [evidenceFields, setEvidenceFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const runQuery = useQuery({
    queryKey: ['sop-run', runId],
    queryFn: () => fetchSopRunById(supabase, runId),
    enabled: !!runId,
  });

  const run = runQuery.data;

  const requiredKeys = useMemo(() => {
    if (!run?.sop_definitions || typeof run.sop_definitions !== 'object') return [];
    const raw =
      'required_inputs_after_execution' in run.sop_definitions
        ? (run.sop_definitions as { required_inputs_after_execution: unknown })
            .required_inputs_after_execution
        : [];
    return parseRequiredInputKeys(raw);
  }, [run]);

  function isEvidenceKey(key: string): boolean {
    const k = key.toLowerCase();
    return k.includes('photo') || k.includes('evidence') || k.endsWith('_image');
  }

  async function submit() {
    if (!farmId || !cycle || !primaryScope || !run) return;
    setPending(true);
    setError(null);
    try {
      const measuredValues: Record<string, unknown> = {};
      const evidenceJson: Record<string, unknown> = {};
      for (const key of requiredKeys) {
        const val = isEvidenceKey(key)
          ? evidenceFields[key]?.trim()
          : measuredFields[key]?.trim();
        if (val) {
          if (isEvidenceKey(key)) evidenceJson[key] = val;
          else measuredValues[key] = val;
        }
      }
      await executeSopRun(supabase, {
        runId: run.id,
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        executionStatus,
        notes,
        userId,
        measuredValues,
        evidenceJson,
      });
      await queryClient.invalidateQueries({ queryKey: [SOP_RUNS_QUERY_KEY] });
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  if (runQuery.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2d6a4f" />
      </View>
    );
  }

  if (!run) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>SOP run not found</Text>
      </View>
    );
  }

  const title = sopRunTitle(run);
  const dueDescription = run.due_at
    ? `Due ${new Date(run.due_at).toLocaleString()}`
    : 'No due date';

  if (!['open', 'acknowledged', 'overdue'].includes(run.status)) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Already closed</Text>
        <Text style={styles.muted}>Status: {run.status}</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{dueDescription}</Text>

        <Text style={styles.label}>Status</Text>
        <View style={styles.chips}>
          {STATUSES.map((s) => (
            <Pressable
              key={s.value}
              style={[styles.chip, executionStatus === s.value && styles.chipActive]}
              onPress={() => setExecutionStatus(s.value)}
            >
              <Text
                style={[styles.chipText, executionStatus === s.value && styles.chipTextActive]}
              >
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>Notes</Text>
        <TextInput
          style={styles.input}
          multiline
          value={notes}
          onChangeText={setNotes}
          placeholder="What happened during execution?"
        />

        {requiredKeys.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Required inputs</Text>
            {requiredKeys.map((key) => {
              const evidence = isEvidenceKey(key);
              return (
                <View key={key} style={styles.fieldBlock}>
                  <Text style={styles.fieldLabel}>{key}</Text>
                  <TextInput
                    style={styles.input}
                    value={evidence ? evidenceFields[key] ?? '' : measuredFields[key] ?? ''}
                    onChangeText={(v) => {
                      if (evidence) {
                        setEvidenceFields((prev) => ({ ...prev, [key]: v }));
                      } else {
                        setMeasuredFields((prev) => ({ ...prev, [key]: v }));
                      }
                    }}
                    placeholder={evidence ? 'Asset ID or reference' : 'Value'}
                  />
                </View>
              );
            })}
          </>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, pending && styles.buttonDisabled]}
          onPress={() => void submit()}
          disabled={pending}
        >
          <Text style={styles.buttonText}>{pending ? 'Saving…' : 'Record execution'}</Text>
        </Pressable>
        <Pressable style={styles.cancel} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#1b4332' },
  subtitle: { fontSize: 14, color: '#52796f', marginBottom: 20, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#52796f',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: '#f3f4f6' },
  chipActive: { backgroundColor: '#2d6a4f' },
  chipText: { fontSize: 13, color: '#374151' },
  chipTextActive: { color: '#fff' },
  input: {
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    textAlignVertical: 'top',
  },
  fieldBlock: { marginBottom: 4 },
  fieldLabel: { fontSize: 13, color: '#52796f', marginBottom: 4 },
  button: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancel: { alignItems: 'center', padding: 14 },
  cancelText: { color: '#6b7280' },
  error: { color: '#b91c1c', marginBottom: 8 },
  muted: { color: '#6b7280', marginTop: 8 },
});
