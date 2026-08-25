import { OfflineQueuePanel } from '@/components/settings/OfflineQueuePanel';
import { useFarmContext } from '@/providers/FarmProvider';
import { registerForPushNotifications } from '@/lib/notifications';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function SettingsScreen() {
  const {
    supabase,
    farms,
    farmId,
    setFarmId,
    cycle,
    scopes,
    scopeId,
    setScopeId,
    refetchAll,
  } = useFarmContext();
  const farm = farms.find((f) => f.id === farmId);
  const [name, setName] = useState(farm?.name ?? '');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [plants, setPlants] = useState<{ id: string; plant_code: string; status: string }[]>([]);
  const [plantLabel, setPlantLabel] = useState('');

  useEffect(() => {
    if (farm) setName(farm.name);
  }, [farm]);

  useEffect(() => {
    if (!farmId || !cycle?.id) return;
    void (async () => {
      const { data } = await supabase
        .from('plants')
        .select('id, plant_code, status')
        .eq('farm_id', farmId)
        .eq('cycle_id', cycle.id)
        .order('created_at', { ascending: true });
      setPlants((data ?? []) as { id: string; plant_code: string; status: string }[]);
    })();
  }, [supabase, farmId, cycle?.id]);

  async function saveFarmName() {
    if (!farmId) return;
    setPending(true);
    setMsg(null);
    try {
      const { error } = await supabase.from('farms').update({ name: name.trim() }).eq('id', farmId);
      if (error) throw error;
      await refetchAll();
      setMsg('Saved.');
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : 'Error');
    } finally {
      setPending(false);
    }
  }

  async function addPlant() {
    if (!farmId || !cycle?.id) return;
    setPending(true);
    try {
      const code = plantLabel.trim() || `plant-${Date.now()}`;
      const { error } = await supabase.from('plants').insert({
        farm_id: farmId,
        cycle_id: cycle.id,
        plant_code: code,
        status: 'active',
      });
      if (error) throw error;
      setPlantLabel('');
      const { data } = await supabase
        .from('plants')
        .select('id, plant_code, status')
        .eq('farm_id', farmId)
        .eq('cycle_id', cycle.id);
      setPlants((data ?? []) as { id: string; plant_code: string; status: string }[]);
    } finally {
      setPending(false);
    }
  }

  async function enablePush() {
    const token = await registerForPushNotifications(supabase);
    setPushToken(token);
    setMsg(token ? 'Push notifications enabled and registered.' : 'Push permission denied.');
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>Farm</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />
      <Pressable style={styles.btn} onPress={() => void saveFarmName()} disabled={pending}>
        <Text style={styles.btnText}>{pending ? 'Saving…' : 'Save farm name'}</Text>
      </Pressable>

      {farms.length > 1 && (
        <>
          <Text style={styles.section}>Active farm</Text>
          {farms.map((f) => (
            <Pressable
              key={f.id}
              style={[styles.row, f.id === farmId && styles.rowActive]}
              onPress={() => setFarmId(f.id)}
            >
              <Text>{f.name}</Text>
            </Pressable>
          ))}
        </>
      )}

      {cycle && (
        <View style={styles.card}>
          <Text style={styles.section}>Active cycle</Text>
          <Text style={styles.body}>
            {cycle.name} · {cycle.stage} · since {cycle.start_date}
          </Text>
        </View>
      )}

      {scopes.length > 1 && (
        <>
          <Text style={styles.section}>Scope</Text>
          {scopes.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.row, s.id === scopeId && styles.rowActive]}
              onPress={() => setScopeId(s.id)}
            >
              <Text>{s.display_name || s.scope_type}</Text>
            </Pressable>
          ))}
        </>
      )}

      <Text style={styles.section}>Plants</Text>
      {plants.length === 0 ? (
        <Text style={styles.muted}>No plants yet.</Text>
      ) : (
        plants.map((p) => (
          <Text key={p.id} style={styles.body}>
            {p.plant_code} · {p.status}
          </Text>
        ))
      )}
      <View style={styles.rowInputs}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Plant code"
          value={plantLabel}
          onChangeText={setPlantLabel}
        />
        <Pressable style={styles.btnSmall} onPress={() => void addPlant()}>
          <Text style={styles.btnText}>Add</Text>
        </Pressable>
      </View>

      <Text style={styles.section}>Offline sync</Text>
      <OfflineQueuePanel />

      <Text style={styles.section}>Notifications</Text>
      <Pressable style={styles.btn} onPress={() => void enablePush()}>
        <Text style={styles.btnText}>Enable push notifications</Text>
      </Pressable>
      {pushToken ? <Text style={styles.mutedSmall}>Token registered (local)</Text> : null}

      {msg ? <Text style={styles.ok}>{msg}</Text> : null}

      <Pressable style={styles.logout} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.logoutText}>Log out</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, paddingBottom: 120 },
  section: {
    fontSize: 13,
    fontWeight: '700',
    color: '#52796f',
    marginTop: 16,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 8,
  },
  row: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowActive: { borderColor: '#2d6a4f', backgroundColor: '#f0fdf4' },
  rowInputs: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  card: { marginBottom: 8 },
  body: { fontSize: 15, color: '#374151', marginBottom: 4 },
  btn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  btnSmall: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  btnText: { color: '#fff', fontWeight: '600' },
  muted: { color: '#6b7280', fontSize: 14 },
  mutedSmall: { color: '#9ca3af', fontSize: 11, marginTop: 4 },
  ok: { color: '#166534', marginTop: 12 },
  logout: {
    marginTop: 32,
    padding: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  logoutText: { color: '#b91c1c', fontWeight: '600' },
});
