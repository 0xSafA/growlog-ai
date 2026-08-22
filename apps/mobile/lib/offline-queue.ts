import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EventType, SourceType } from '@growlog/domain';

const QUEUE_KEY = 'growlog_offline_queue_v1';

export type PendingLogPayload = {
  farmId: string;
  cycleId: string;
  scopeId: string;
  eventType: EventType;
  body: string;
  occurredAt: string;
  sourceType: SourceType;
  createdBy?: string | null;
  payload?: Record<string, unknown>;
};

export type PendingPhotoPayload = {
  farmId: string;
  cycleId: string;
  scopeId: string;
  localUri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  caption?: string;
  userId?: string | null;
};

export type PendingCapture =
  | {
      id: string;
      kind: 'log';
      payload: PendingLogPayload;
      status: 'pending' | 'failed';
      createdAt: string;
      retryCount: number;
    }
  | {
      id: string;
      kind: 'photo';
      payload: PendingPhotoPayload;
      status: 'pending' | 'failed';
      createdAt: string;
      retryCount: number;
    };

async function readQueue(): Promise<PendingCapture[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingCapture[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeQueue(items: PendingCapture[]): Promise<void> {
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items));
  notifyQueueChanged();
}

type QueueListener = () => void;
const listeners = new Set<QueueListener>();

export function subscribeOfflineQueue(listener: QueueListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notifyQueueChanged() {
  for (const listener of listeners) listener();
}

export async function getOfflineQueue(): Promise<PendingCapture[]> {
  return readQueue();
}

export async function enqueueLogEntry(payload: PendingLogPayload): Promise<string> {
  const id = crypto.randomUUID();
  const items = await readQueue();
  items.push({
    id,
    kind: 'log',
    payload,
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await writeQueue(items);
  return id;
}

export async function enqueuePhotoCapture(payload: PendingPhotoPayload): Promise<string> {
  const id = crypto.randomUUID();
  const items = await readQueue();
  items.push({
    id,
    kind: 'photo',
    payload,
    status: 'pending',
    createdAt: new Date().toISOString(),
    retryCount: 0,
  });
  await writeQueue(items);
  return id;
}

export async function removeQueueItem(id: string): Promise<void> {
  const items = await readQueue();
  await writeQueue(items.filter((i) => i.id !== id));
}

export async function markQueueItemFailed(id: string): Promise<void> {
  const items = await readQueue();
  const next = items.map((i) =>
    i.id === id ? { ...i, status: 'failed' as const, retryCount: i.retryCount + 1 } : i
  );
  await writeQueue(next);
}

export async function requeueItem(id: string): Promise<void> {
  const items = await readQueue();
  const next = items.map((i) => (i.id === id ? { ...i, status: 'pending' as const } : i));
  await writeQueue(next);
}

export async function clearFailedQueueItems(): Promise<void> {
  const items = await readQueue();
  await writeQueue(items.filter((i) => i.status !== 'failed' || i.retryCount < 5));
}
