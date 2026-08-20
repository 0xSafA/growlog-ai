import { useFarmContext } from '@/providers/FarmProvider';
import { createFoundationSetup } from '@growlog/domain';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
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

export default function OnboardingScreen() {
  const router = useRouter();
  const { supabase, authLoading, userId, farms, farmListReady, refetchAll } = useFarmContext();
  const [farmName, setFarmName] = useState('');
  const [cycleName, setCycleName] = useState('Cycle 1');
  const [cultivar, setCultivar] = useState('');
  const [stage, setStage] = useState('veg');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const tz =
    typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC';

  useEffect(() => {
    if (authLoading) return;
    if (!userId) router.replace('/(auth)/login');
  }, [authLoading, userId, router]);

  useEffect(() => {
    if (farmListReady && farms.length > 0) {
      router.replace('/(tabs)');
    }
  }, [farmListReady, farms.length, router]);

  async function handleCreate() {
    if (!userId || !farmName.trim()) return;
    setError(null);
    setPending(true);
    try {
      const start = new Date().toISOString().slice(0, 10);
      await createFoundationSetup(supabase, {
        farmName: farmName.trim(),
        timezone: tz,
        cycleName: cycleName.trim() || 'Cycle 1',
        cultivarName: cultivar.trim() || undefined,
        startDate: start,
        stage,
      });
      await refetchAll();
      router.replace('/(tabs)');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Setup failed');
    } finally {
      setPending(false);
    }
  }

  if (authLoading || !userId) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2d6a4f" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Set up your farm</Text>
        <Text style={styles.subtitle}>Create a farm and your first grow cycle.</Text>

        <Text style={styles.label}>Farm name</Text>
        <TextInput style={styles.input} value={farmName} onChangeText={setFarmName} />

        <Text style={styles.label}>Cycle name</Text>
        <TextInput style={styles.input} value={cycleName} onChangeText={setCycleName} />

        <Text style={styles.label}>Cultivar (optional)</Text>
        <TextInput style={styles.input} value={cultivar} onChangeText={setCultivar} />

        <Text style={styles.label}>Stage</Text>
        <TextInput style={styles.input} value={stage} onChangeText={setStage} autoCapitalize="none" />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.button, pending && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={pending}
        >
          <Text style={styles.buttonText}>{pending ? 'Creating…' : 'Start journaling'}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 24, paddingTop: 48 },
  title: { fontSize: 24, fontWeight: '700', color: '#1b4332' },
  subtitle: { fontSize: 15, color: '#52796f', marginBottom: 24, marginTop: 8 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6, color: '#374151' },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#b7d4bc',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  error: { color: '#b91c1c', marginBottom: 8 },
});
