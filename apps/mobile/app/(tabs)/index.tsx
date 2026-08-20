import { useFarmContext } from '@/providers/FarmProvider';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';

export default function DailyFocusScreen() {
  const { cycle, todayEvents, recentEvents, loading, primaryScope } = useFarmContext();

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Loading…</Text>
      </View>
    );
  }

  if (!cycle || !primaryScope) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Complete onboarding first.</Text>
      </View>
    );
  }

  const risks = recentEvents.filter((e) =>
    ['issue_detected', 'pest_detected', 'deficiency_suspected', 'anomaly'].includes(e.event_type)
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Cycle</Text>
        <Text style={styles.cardBody}>
          {cycle.name} · stage {cycle.stage ?? '—'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today</Text>
        <Text style={styles.cardBody}>{todayEvents.length} events logged today</Text>
      </View>

      {risks.length > 0 && (
        <View style={[styles.card, styles.riskCard]}>
          <Text style={styles.cardTitle}>Risks</Text>
          {risks.slice(0, 3).map((e) => (
            <Text key={e.id} style={styles.cardBody}>
              · {e.event_type}: {e.body?.slice(0, 80) ?? '—'}
            </Text>
          ))}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Recent</Text>
        {recentEvents.length === 0 ? (
          <Text style={styles.muted}>No events yet. Tap Log to capture your first entry.</Text>
        ) : (
          recentEvents.slice(0, 5).map((e) => (
            <Text key={e.id} style={styles.eventRow}>
              {e.event_type}: {e.body?.slice(0, 60) ?? '—'}
            </Text>
          ))
        )}
      </View>

      <Pressable style={styles.cta} onPress={() => router.push('/capture')}>
        <Text style={styles.ctaText}>Quick log</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 120, gap: 12 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#d8ead9',
  },
  riskCard: { borderColor: '#fbbf24', backgroundColor: '#fffbeb' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#52796f', marginBottom: 6, textTransform: 'uppercase' },
  cardBody: { fontSize: 15, color: '#1f2937', lineHeight: 22 },
  eventRow: { fontSize: 14, color: '#374151', marginBottom: 6 },
  muted: { color: '#6b7280', fontSize: 14 },
  cta: {
    backgroundColor: '#40916c',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
