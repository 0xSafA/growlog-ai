import { enqueuePhotoCapture } from '@/lib/offline-queue';
import {
  createPhotoCaptureUpload,
  formatPhotoSizeLimit,
  getMaxPhotoBytesVisionClient,
} from '@growlog/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import NetInfo from '@react-native-community/netinfo';

export type PhotoPickResult = {
  uri: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
};

export async function uploadPhotoCapture(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string;
    scopeId: string;
    pick: PhotoPickResult;
    caption?: string;
    userId?: string | null;
    offlineOk?: boolean;
  }
): Promise<'uploaded' | 'queued'> {
  const maxBytes = getMaxPhotoBytesVisionClient();
  if (params.pick.fileSize > maxBytes) {
    throw new Error(
      `File too large (${formatPhotoSizeLimit(params.pick.fileSize)}). Max ${formatPhotoSizeLimit(maxBytes)}.`
    );
  }

  const net = await NetInfo.fetch();
  const offline = net.isConnected === false || net.isInternetReachable === false;

  if (offline && params.offlineOk !== false) {
    await enqueuePhotoCapture({
      farmId: params.farmId,
      cycleId: params.cycleId,
      scopeId: params.scopeId,
      localUri: params.pick.uri,
      fileName: params.pick.fileName,
      mimeType: params.pick.mimeType,
      fileSize: params.pick.fileSize,
      caption: params.caption,
      userId: params.userId,
    });
    return 'queued';
  }

  const res = await fetch(params.pick.uri);
  const buf = await res.arrayBuffer();
  await createPhotoCaptureUpload(supabase, {
    farmId: params.farmId,
    cycleId: params.cycleId,
    scopeId: params.scopeId,
    bytes: buf,
    fileName: params.pick.fileName,
    mimeType: params.pick.mimeType,
    fileSize: params.pick.fileSize,
    caption: params.caption,
    userId: params.userId,
  });
  return 'uploaded';
}
