import {
  createLogEntry,
  createPhotoCaptureUpload,
} from '@growlog/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getOfflineQueue,
  markQueueItemFailed,
  removeQueueItem,
  requeueItem,
  type PendingCapture,
} from '@/lib/offline-queue';

async function syncOne(supabase: SupabaseClient, item: PendingCapture): Promise<boolean> {
  try {
    if (item.kind === 'log') {
      const p = item.payload;
      await createLogEntry(supabase, {
        farmId: p.farmId,
        cycleId: p.cycleId,
        scopeId: p.scopeId,
        eventType: p.eventType,
        body: p.body,
        occurredAt: p.occurredAt,
        sourceType: p.sourceType,
        createdBy: p.createdBy,
        payload: p.payload,
      });
    } else {
      const p = item.payload;
      const res = await fetch(p.localUri);
      const buf = await res.arrayBuffer();
      const fileSize = p.fileSize > 0 ? p.fileSize : buf.byteLength;
      await createPhotoCaptureUpload(supabase, {
        farmId: p.farmId,
        cycleId: p.cycleId,
        scopeId: p.scopeId,
        bytes: buf,
        fileName: p.fileName,
        mimeType: p.mimeType,
        fileSize,
        caption: p.caption,
        userId: p.userId,
      });
    }
    await removeQueueItem(item.id);
    return true;
  } catch {
    await markQueueItemFailed(item.id);
    return false;
  }
}

export async function flushOfflineQueue(supabase: SupabaseClient): Promise<{
  synced: number;
  failed: number;
}> {
  const items = await getOfflineQueue();
  let synced = 0;
  let failed = 0;
  for (const item of items.filter((i) => i.retryCount < 5)) {
    if (item.status === 'failed') {
      await requeueItem(item.id);
    }
    const ok = await syncOne(supabase, item);
    if (ok) synced += 1;
    else failed += 1;
  }
  return { synced, failed };
}
