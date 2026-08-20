import { useFarmContext } from '@/providers/FarmProvider';
import { FlatList, StyleSheet, Text, View } from 'react-native';

export default function TimelineScreen() {
  const { recentEvents, loading } = useFarmContext();

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading timeline…</Text>
      </View>
    );
  }

  return (
    <FlatList
      contentContainerStyle={styles.list}
      data={recentEvents}
      keyExtractor={(item) => item.id}
      ListEmptyComponent={
        <Text style={styles.muted}>No events yet. Use Log to add your first entry.</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <Text style={styles.type}>{item.event_type}</Text>
          <Text style={styles.body}>{item.body ?? '—'}</Text>
          <Text style={styles.time}>{new Date(item.occurred_at).toLocaleString()}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 16, paddingBottom: 120, gap: 10 },
  row: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginBottom: 10,
  },
  type: { fontSize: 12, fontWeight: '700', color: '#2d6a4f', textTransform: 'uppercase' },
  body: { fontSize: 15, color: '#111827', marginTop: 4 },
  time: { fontSize: 12, color: '#9ca3af', marginTop: 6 },
  muted: { color: '#6b7280', textAlign: 'center', padding: 24 },
});
