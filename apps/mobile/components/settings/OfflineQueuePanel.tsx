import { flushOfflineQueue } from '@/lib/offline-sync';
import {
  getOfflineQueue,
  removeQueueItem,
  requeueItem,
  type PendingCapture,
} from '@/lib/offline-queue';
import { useOfflineSync } from '@/providers/OfflineSyncProvider';
import { useFarmContext } from '@/providers/FarmProvider';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

function preview(item: PendingCapture): string {
  if (item.kind === 'log') {
    return `${item.payload.eventType}: ${item.payload.body.slice(0, 60)}`;
  }
  return `Photo: ${item.payload.fileName}`;
}

export function OfflineQueuePanel() {
  const { supabase } = useFarmContext();
  const { queueCount, syncing, syncNow, refreshQueueCount, lastSyncResult } = useOfflineSync();
  const [items, setItems] = useState<PendingCapture[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await getOfflineQueue());
      await refreshQueueCount();
    } finally {
      setLoading(false);
    }
  }, [refreshQueueCount]);

  useEffect(() => {
    void reload();
  }, [reload, queueCount]);

  async function discard(id: string) {
    await removeQueueItem(id);
    await reload();
  }

  async function retryOne(id: string) {
    await requeueItem(id);
    await flushOfflineQueue(supabase);
    await reload();
  }

  return (
    <View>
      <Text style={styles.body}>Pending items: {queueCount}</Text>
      {lastSyncResult && (
        <Text style={styles.muted}>
          Last sync: {lastSyncResult.synced} uploaded, {lastSyncResult.failed} failed
        </Text>
      )}
      {loading && <ActivityIndicator color="#2d6a4f" style={{ marginVertical: 8 }} />}
      {!loading && items.length === 0 && (
        <Text style={styles.muted}>Queue is empty.</Text>
      )}
      {items.map((item) => (
        <View key={item.id} style={styles.row}>
          <Text style={styles.rowKind}>
            {item.kind} · {item.status}
            {item.retryCount > 0 ? ` · retries ${item.retryCount}` : ''}
          </Text>
          <Text style={styles.rowPreview}>{preview(item)}</Text>
          <View style={styles.rowActions}>
            {(item.status === 'failed' || item.retryCount > 0) && (
              <Pressable onPress={() => void retryOne(item.id)}>
                <Text style={styles.link}>Retry</Text>
              </Pressable>
            )}
            <Pressable onPress={() => void discard(item.id)}>
              <Text style={styles.discard}>Discard</Text>
            </Pressable>
          </View>
        </View>
      ))}
      <Pressable style={styles.btn} onPress={() => void syncNow()} disabled={syncing}>
        {syncing ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>Sync all now</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { fontSize: 15, color: '#374151', marginBottom: 8 },
  muted: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  row: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  rowKind: { fontSize: 11, fontWeight: '700', color: '#52796f', textTransform: 'uppercase' },
  rowPreview: { fontSize: 14, color: '#1f2937', marginTop: 4, lineHeight: 20 },
  rowActions: { flexDirection: 'row', gap: 16, marginTop: 8 },
  link: { fontSize: 13, fontWeight: '600', color: '#2d6a4f' },
  discard: { fontSize: 13, fontWeight: '600', color: '#b91c1c' },
  btn: {
    marginTop: 8,
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    padding: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '600' },
});
