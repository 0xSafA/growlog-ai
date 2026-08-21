import { useFarmContext } from '@/providers/FarmProvider';
import { fetchReportById } from '@growlog/domain';
import type { ReportBlock, ReportJsonV1 } from '@growlog/domain';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';

function isReportJsonV1(x: unknown): x is ReportJsonV1 {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return o.pipeline_version === 'adr007-v1' && Array.isArray(o.blocks);
}

function BlockView({ block }: { block: ReportBlock }) {
  if (block.kind === 'header') {
    return (
      <View style={styles.block}>
        <Text style={styles.heading}>{block.title}</Text>
        <Text style={styles.muted}>
          {block.periodLabel} · {block.scopeLabel}
        </Text>
      </View>
    );
  }
  if (block.kind === 'executive_summary' || block.kind === 'narrative' || block.kind === 'appendix') {
    return (
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>{block.title}</Text>
        <Text style={styles.paragraph}>{block.body}</Text>
      </View>
    );
  }
  if (block.kind === 'metric_strip') {
    return (
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>{block.title}</Text>
        {block.items.map((item, i) => (
          <Text key={i} style={styles.paragraph}>
            {item.label}: {item.value}
          </Text>
        ))}
      </View>
    );
  }
  if (block.kind === 'timeline_highlights' || block.kind === 'anomalies' || block.kind === 'sop_compliance') {
    return (
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>{block.title}</Text>
        {block.items.map((item, i) => (
          <Text key={i} style={styles.paragraph}>
            · {'summary' in item ? item.summary : 'title' in item ? item.title : ''}
          </Text>
        ))}
      </View>
    );
  }
  if (block.kind === 'photos') {
    return (
      <Text style={styles.muted}>
        {block.items.length} photo(s) — open web companion for full layout.
      </Text>
    );
  }
  if (block.kind === 'missing_data') {
    return (
      <View style={styles.block}>
        <Text style={styles.sectionTitle}>{block.title}</Text>
        {block.notes.map((n, i) => (
          <Text key={i} style={styles.paragraph}>
            · {n}
          </Text>
        ))}
      </View>
    );
  }
  return null;
}

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const reportId = typeof id === 'string' ? id : '';
  const { supabase, farmId } = useFarmContext();

  const q = useQuery({
    queryKey: ['report', farmId, reportId],
    enabled: !!farmId && !!reportId,
    queryFn: () => fetchReportById(supabase, farmId!, reportId),
  });

  const report = q.data;
  const rj = report?.report_json;
  const blocks: ReportBlock[] = isReportJsonV1(rj) && rj.blocks.length ? rj.blocks : [];

  if (q.isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2d6a4f" />
      </View>
    );
  }

  if (!report) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Report not found</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{report.title}</Text>
      <Text style={styles.meta}>
        {report.status} · {report.report_type}
        {report.period_start && report.period_end
          ? ` · ${report.period_start.slice(0, 10)} — ${report.period_end.slice(0, 10)}`
          : ''}
      </Text>

      {report.summary_text ? (
        <>
          <Text style={styles.sectionTitle}>Summary</Text>
          <Text style={styles.paragraph}>{report.summary_text}</Text>
        </>
      ) : null}

      {report.narrative_text ? (
        <>
          <Text style={styles.sectionTitle}>Narrative</Text>
          <Text style={styles.paragraph}>{report.narrative_text}</Text>
        </>
      ) : null}

      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}

      {report.status === 'draft' && (
        <Text style={styles.draft}>Report is still generating…</Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '700', color: '#1b4332' },
  meta: { fontSize: 13, color: '#6b7280', marginBottom: 16, marginTop: 4 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#52796f',
    marginTop: 16,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  heading: { fontSize: 18, fontWeight: '700', marginTop: 16, color: '#1f2937' },
  block: { marginTop: 8 },
  paragraph: { fontSize: 15, lineHeight: 22, color: '#374151', marginTop: 8 },
  muted: { fontSize: 13, color: '#9ca3af', marginTop: 8, fontStyle: 'italic' },
  draft: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#fffbeb',
    borderRadius: 8,
    color: '#92400e',
  },
  error: { color: '#b91c1c' },
});
