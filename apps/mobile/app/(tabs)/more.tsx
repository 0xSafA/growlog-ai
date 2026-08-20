import { useFarmContext } from '@/providers/FarmProvider';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

export default function MoreScreen() {
  const { supabase, farms, farmId, setFarmId, scopes, scopeId, setScopeId } = useFarmContext();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.section}>Farm</Text>
      {farms.map((f) => (
        <Pressable
          key={f.id}
          style={[styles.row, f.id === farmId && styles.rowActive]}
          onPress={() => setFarmId(f.id)}
        >
          <Text>{f.name}</Text>
        </Pressable>
      ))}

      <Text style={styles.section}>Scope</Text>
      {scopes.map((s) => (
        <Pressable
          key={s.id}
          style={[styles.row, s.id === scopeId && styles.rowActive]}
          onPress={() => setScopeId(s.id)}
        >
          <Text>{s.display_name}</Text>
        </Pressable>
      ))}

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
  row: {
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowActive: { borderColor: '#2d6a4f', backgroundColor: '#f0fdf4' },
  logout: {
    marginTop: 32,
    padding: 14,
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#fef2f2',
  },
  logoutText: { color: '#b91c1c', fontWeight: '600' },
});
