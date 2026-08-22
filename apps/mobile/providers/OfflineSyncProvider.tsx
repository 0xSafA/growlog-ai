import { flushOfflineQueue } from '@/lib/offline-sync';
import { getOfflineQueue, subscribeOfflineQueue } from '@/lib/offline-queue';
import { useFarmContext } from '@/providers/FarmProvider';
import NetInfo from '@react-native-community/netinfo';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';

type OfflineSyncContextValue = {
  queueCount: number;
  syncing: boolean;
  lastSyncResult: { synced: number; failed: number } | null;
  refreshQueueCount: () => Promise<void>;
  syncNow: () => Promise<void>;
};

const OfflineSyncContext = createContext<OfflineSyncContextValue | null>(null);

export function OfflineSyncProvider({ children }: { children: ReactNode }) {
  const { supabase, userId, refetchAll } = useFarmContext();
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<{ synced: number; failed: number } | null>(
    null
  );

  const refreshQueueCount = useCallback(async () => {
    const q = await getOfflineQueue();
    setQueueCount(q.filter((i) => i.status === 'pending' || i.status === 'failed').length);
  }, []);

  const syncNow = useCallback(async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      const result = await flushOfflineQueue(supabase);
      setLastSyncResult(result);
      if (result.synced > 0) await refetchAll();
      await refreshQueueCount();
    } finally {
      setSyncing(false);
    }
  }, [supabase, userId, refetchAll, refreshQueueCount]);

  useEffect(() => {
    void refreshQueueCount();
    return subscribeOfflineQueue(() => {
      void refreshQueueCount();
    });
  }, [refreshQueueCount]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshQueueCount();
    });
    return () => sub.remove();
  }, [refreshQueueCount]);

  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      if (state.isConnected && state.isInternetReachable !== false) {
        void syncNow();
      }
    });
    return unsub;
  }, [syncNow]);

  return (
    <OfflineSyncContext.Provider
      value={{ queueCount, syncing, lastSyncResult, refreshQueueCount, syncNow }}
    >
      {children}
    </OfflineSyncContext.Provider>
  );
}

export function useOfflineSync() {
  const ctx = useContext(OfflineSyncContext);
  if (!ctx) throw new Error('useOfflineSync must be used within OfflineSyncProvider');
  return ctx;
}
