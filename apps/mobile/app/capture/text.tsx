import { useFarmContext } from '@/providers/FarmProvider';
import { enqueueLogEntry } from '@/lib/offline-queue';
import { createLogEntry, type EventType } from '@growlog/domain';
import NetInfo from '@react-native-community/netinfo';
import { router } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const QUICK_TYPES: EventType[] = [
  'note',
  'observation',
  'action_taken',
  'watering',
  'feeding',
  'issue_detected',
];

export default function TextCaptureScreen() {
  const { supabase, farmId, cycle, primaryScope, userId, refetchAll } = useFarmContext();
  const [eventType, setEventType] = useState<EventType>('note');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit() {
    if (!farmId || !cycle || !primaryScope || !body.trim()) return;
    setError(null);
    setMsg(null);
    setPending(true);
    try {
      const payload = {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        eventType,
        body: body.trim(),
        occurredAt: new Date().toISOString(),
        sourceType: 'user_form' as const,
        createdBy: userId,
      };
      const net = await NetInfo.fetch();
      const offline = net.isConnected === false || net.isInternetReachable === false;
      if (offline) {
        await enqueueLogEntry(payload);
        setMsg('Saved offline — will sync when online.');
        setBody('');
        setTimeout(() => {
          router.back();
          router.back();
        }, 800);
        return;
      }
      await createLogEntry(supabase, payload);
      await refetchAll();
      router.back();
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return (
      <View style={styles.center}>
        <Text>Complete onboarding first.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.label}>Event type</Text>
        <View style={styles.chips}>
          {QUICK_TYPES.map((t) => (
            <Pressable
              key={t}
              style={[styles.chip, eventType === t && styles.chipActive]}
              onPress={() => setEventType(t)}
            >
              <Text style={[styles.chipText, eventType === t && styles.chipTextActive]}>{t}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.label}>What happened?</Text>
        <TextInput
          style={styles.input}
          multiline
          numberOfLines={5}
          value={body}
          onChangeText={setBody}
          placeholder="Describe the observation or action…"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}
        {msg ? <Text style={styles.ok}>{msg}</Text> : null}

        <Pressable
          style={[styles.button, pending && styles.buttonDisabled]}
          onPress={submit}
          disabled={pending}
        >
          <Text style={styles.buttonText}>{pending ? 'Saving…' : 'Save to journal'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8, color: '#374151' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#f3f4f6',
  },
  chipActive: { backgroundColor: '#2d6a4f' },
  chipText: { fontSize: 12, color: '#374151' },
  chipTextActive: { color: '#fff' },
  input: {
    minHeight: 120,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  button: {
    marginTop: 20,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  error: { color: '#b91c1c', marginTop: 8 },
  ok: { color: '#166534', marginTop: 8 },
});
