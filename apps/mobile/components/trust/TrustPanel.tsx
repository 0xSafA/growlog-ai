import type { AskResponse } from '@/lib/advisor-types';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

export function TrustPanel({ response }: { response: AskResponse }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>{response.title ?? 'Response details'}</Text>
      <Text style={styles.meta}>
        {response.insight_type} · {response.model}
      </Text>

      <View style={styles.badgeRow}>
        <Text style={styles.label}>Confidence</Text>
        <Text style={styles.badge}>
          {response.confidence.label} ({Math.round(response.confidence.score * 100)}%)
        </Text>
      </View>

      {response.facts.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Facts</Text>
          {response.facts.map((f, i) => (
            <Text key={i} style={styles.bullet}>
              · {f}
            </Text>
          ))}
        </View>
      )}

      {response.interpretation ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Interpretation</Text>
          <Text style={styles.body}>{response.interpretation}</Text>
        </View>
      ) : null}

      {response.hypotheses.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hypotheses</Text>
          {response.hypotheses.map((h, i) => (
            <Text key={i} style={styles.bullet}>
              · {h}
            </Text>
          ))}
        </View>
      )}

      {response.recommendation ? (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recommendation</Text>
          <Text style={styles.body}>{response.recommendation}</Text>
        </View>
      ) : null}

      {response.missing_data.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Missing data</Text>
          {response.missing_data.map((m, i) => (
            <Text key={i} style={styles.missing}>
              · {m}
            </Text>
          ))}
        </View>
      )}

      {response.grounding.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Grounding</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {response.grounding.slice(0, 6).map((g, i) => (
              <View key={i} style={styles.groundChip}>
                <Text style={styles.groundType}>{g.source_type}</Text>
                {g.excerpt ? (
                  <Text style={styles.groundExcerpt} numberOfLines={2}>
                    {g.excerpt}
                  </Text>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {response.trust_flags.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Trust flags</Text>
          <Text style={styles.flags}>{response.trust_flags.join(', ')}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d8ead9',
    padding: 16,
    marginTop: 12,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#1b4332' },
  meta: { fontSize: 12, color: '#6b7280', marginTop: 4, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
  label: { fontSize: 12, color: '#52796f', fontWeight: '600' },
  badge: {
    fontSize: 12,
    backgroundColor: '#ecfdf5',
    color: '#065f46',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  section: { marginTop: 12 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#52796f',
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  body: { fontSize: 14, color: '#1f2937', lineHeight: 20 },
  bullet: { fontSize: 14, color: '#374151', marginBottom: 4, lineHeight: 20 },
  missing: { fontSize: 14, color: '#b45309', marginBottom: 4 },
  groundChip: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 10,
    marginRight: 8,
    maxWidth: 200,
  },
  groundType: { fontSize: 11, fontWeight: '700', color: '#374151' },
  groundExcerpt: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  flags: { fontSize: 13, color: '#92400e' },
});
