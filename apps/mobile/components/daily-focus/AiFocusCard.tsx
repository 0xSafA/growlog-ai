import {
  fetchInsightGrounding,
  type DailyFocusInsightRow,
  type InsightGroundingRow,
} from '@growlog/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

function confidenceStyle(label: string | null) {
  const l = (label ?? '').toLowerCase();
  if (l.includes('low') || l.includes('uncertain')) {
    return { badge: styles.confLow, text: styles.confLowText };
  }
  if (l.includes('high')) {
    return { badge: styles.confHigh, text: styles.confHighText };
  }
  return { badge: styles.confMed, text: styles.confMedText };
}

function formatInsightType(type: string) {
  return type.replace(/_/g, ' ');
}

type Props = {
  insight: DailyFocusInsightRow;
  supabase: SupabaseClient;
  onOpenAssistant?: () => void;
};

export function AiFocusCard({ insight, supabase, onOpenAssistant }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [grounding, setGrounding] = useState<InsightGroundingRow[] | null>(null);
  const [groundingLoading, setGroundingLoading] = useState(false);
  const [groundingError, setGroundingError] = useState<string | null>(null);

  const conf = confidenceStyle(insight.confidence_label);
  const confidencePct =
    insight.confidence != null ? Math.round(Number(insight.confidence) * 100) : null;

  async function toggleEvidence() {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (grounding !== null) return;
    setGroundingLoading(true);
    setGroundingError(null);
    try {
      const rows = await fetchInsightGrounding(supabase, insight.id);
      setGrounding(rows);
    } catch (err: unknown) {
      setGroundingError(err instanceof Error ? err.message : 'Could not load evidence');
    } finally {
      setGroundingLoading(false);
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{insight.title ?? 'AI insight'}</Text>
        <View style={styles.typeChip}>
          <Text style={styles.typeChipText}>{formatInsightType(insight.insight_type)}</Text>
        </View>
      </View>

      <Text style={styles.body} numberOfLines={expanded ? undefined : 4}>
        {insight.body}
      </Text>

      <View style={styles.trustRow}>
        <Text style={styles.trustLabel}>Confidence</Text>
        {insight.confidence_label ? (
          <View style={[styles.confBadge, conf.badge]}>
            <Text style={[styles.confBadgeText, conf.text]}>
              {insight.confidence_label}
              {confidencePct != null ? ` (${confidencePct}%)` : ''}
            </Text>
          </View>
        ) : (
          <Text style={styles.trustUnknown}>Unknown</Text>
        )}
      </View>

      <Text style={styles.aiNote}>AI-generated · verify against farm data</Text>

      <View style={styles.actions}>
        <Pressable onPress={() => void toggleEvidence()}>
          <Text style={styles.link}>{expanded ? 'Hide evidence' : 'Show evidence'}</Text>
        </Pressable>
        {onOpenAssistant ? (
          <Pressable onPress={onOpenAssistant}>
            <Text style={styles.link}>Ask in Assistant</Text>
          </Pressable>
        ) : null}
      </View>

      {expanded && (
        <View style={styles.evidenceBox}>
          {groundingLoading && <ActivityIndicator color="#2d6a4f" />}
          {groundingError ? <Text style={styles.evidenceError}>{groundingError}</Text> : null}
          {!groundingLoading && grounding?.length === 0 && (
            <Text style={styles.evidenceEmpty}>No grounding links stored for this insight.</Text>
          )}
          {grounding && grounding.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {grounding.map((g, i) => (
                <View key={`${g.source_type}-${g.source_id ?? i}`} style={styles.groundChip}>
                  <Text style={styles.groundType}>{g.source_type}</Text>
                  {g.excerpt ? (
                    <Text style={styles.groundExcerpt} numberOfLines={3}>
                      {g.excerpt}
                    </Text>
                  ) : null}
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#f8faf9',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#d8ead9',
    padding: 14,
    marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8 },
  title: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1b4332', lineHeight: 20 },
  typeChip: {
    backgroundColor: '#ecfdf5',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeChipText: { fontSize: 10, fontWeight: '600', color: '#065f46', textTransform: 'capitalize' },
  body: { fontSize: 14, color: '#374151', lineHeight: 21 },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  trustLabel: { fontSize: 12, fontWeight: '600', color: '#52796f' },
  confBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  confBadgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  confHigh: { backgroundColor: '#dcfce7' },
  confHighText: { color: '#166534' },
  confMed: { backgroundColor: '#fef9c3' },
  confMedText: { color: '#854d0e' },
  confLow: { backgroundColor: '#ffedd5' },
  confLowText: { color: '#9a3412' },
  trustUnknown: { fontSize: 12, color: '#9ca3af' },
  aiNote: { fontSize: 11, color: '#9ca3af', marginTop: 8, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 16, marginTop: 10 },
  link: { fontSize: 13, fontWeight: '600', color: '#2d6a4f' },
  evidenceBox: { marginTop: 12, minHeight: 32 },
  evidenceEmpty: { fontSize: 13, color: '#6b7280' },
  evidenceError: { fontSize: 13, color: '#b91c1c' },
  groundChip: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    padding: 10,
    marginRight: 8,
    maxWidth: 220,
  },
  groundType: { fontSize: 11, fontWeight: '700', color: '#374151' },
  groundExcerpt: { fontSize: 12, color: '#6b7280', marginTop: 4, lineHeight: 17 },
});
