import { useFarmContext } from '@/providers/FarmProvider';
import { createSopDefinitionWithAssignment, SOP_RUNS_QUERY_KEY } from '@growlog/domain';
import { router, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
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

export default function SopNewScreen() {
  const { supabase, farmId, cycle, primaryScope } = useFarmContext();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [localTime, setLocalTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!farmId || !cycle || !primaryScope || !title.trim()) return;
    setError(null);
    setPending(true);
    try {
      await createSopDefinitionWithAssignment(supabase, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        title: title.trim(),
        description: description.trim(),
        localTime,
        appliesToScope: 'tent',
      });
      await queryClient.invalidateQueries({ queryKey: ['sop-definitions', farmId] });
      await queryClient.invalidateQueries({ queryKey: [SOP_RUNS_QUERY_KEY, farmId] });
      router.replace('/(tabs)/sop');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not create SOP');
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>An active cycle and scope are required.</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'New SOP' }} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.intro}>
            Create a daily recurring procedure assigned to this cycle and scope.
          </Text>

          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Morning VPD check"
          />

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            multiline
            placeholder="What should the operator do?"
          />

          <Text style={styles.label}>Due time (local)</Text>
          <TextInput
            style={styles.input}
            value={localTime}
            onChangeText={setLocalTime}
            placeholder="09:00"
            autoCapitalize="none"
          />
          <Text style={styles.hint}>24-hour format, e.g. 09:00 or 14:30</Text>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Pressable
            style={[styles.btn, pending && styles.btnDisabled]}
            onPress={() => void submit()}
            disabled={pending || !title.trim()}
          >
            {pending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Create SOP</Text>
            )}
          </Pressable>

          <Pressable style={styles.cancel} onPress={() => router.back()}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 40 },
  intro: { fontSize: 14, color: '#52796f', marginBottom: 16, lineHeight: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  btn: {
    marginTop: 24,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  cancel: { marginTop: 16, alignItems: 'center', padding: 12 },
  cancelText: { color: '#6b7280', fontSize: 16 },
  error: { color: '#b91c1c', marginTop: 12 },
  muted: { color: '#6b7280' },
});
