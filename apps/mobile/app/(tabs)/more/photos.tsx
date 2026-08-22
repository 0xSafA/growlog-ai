import { useFarmContext } from '@/providers/FarmProvider';
import { uploadPhotoCapture, type PhotoPickResult } from '@/lib/photo-upload';
import { formatPhotoSizeLimit, getMaxPhotoBytesVisionClient } from '@growlog/domain';
import * as ImagePicker from 'expo-image-picker';
import { router, useSegments } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

export default function PhotosScreen() {
  const segments = useSegments();
  const fromCapture = segments[0] === 'capture';
  const { supabase, farmId, cycle, primaryScope, refetchAll, userId } = useFarmContext();
  const [caption, setCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const maxBytes = getMaxPhotoBytesVisionClient();

  async function pick(source: 'camera' | 'library') {
    if (!farmId || !cycle || !primaryScope) return;
    setError(null);
    setMsg(null);

    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Permission required');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.85, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ quality: 0.85, exif: false });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    let fileSize = asset.fileSize ?? 0;
    if (fileSize <= 0) {
      const probe = await fetch(asset.uri);
      const probeBuf = await probe.arrayBuffer();
      fileSize = probeBuf.byteLength;
    }
    const pick: PhotoPickResult = {
      uri: asset.uri,
      fileName: asset.fileName ?? `photo-${Date.now()}.jpg`,
      mimeType: asset.mimeType ?? 'image/jpeg',
      fileSize,
    };

    if (pick.fileSize > maxBytes) {
      setError(
        `Too large (${formatPhotoSizeLimit(pick.fileSize)}). Max ${formatPhotoSizeLimit(maxBytes)}.`
      );
      return;
    }

    setPending(true);
    try {
      const outcome = await uploadPhotoCapture(supabase, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        pick,
        caption: caption.trim() || undefined,
        userId,
      });
      setCaption('');
      await refetchAll();
      setMsg(outcome === 'queued' ? 'Saved offline — will sync when online.' : 'Photo uploaded.');
      if (fromCapture) {
        router.back();
        router.back();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setPending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Complete onboarding first.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.hint}>Max size: {formatPhotoSizeLimit(maxBytes)}</Text>

      <Text style={styles.label}>Caption (optional)</Text>
      <TextInput style={styles.input} value={caption} onChangeText={setCaption} placeholder="What does this show?" />

      {pending && <ActivityIndicator color="#2d6a4f" style={{ marginVertical: 12 }} />}

      <Pressable style={styles.btn} onPress={() => void pick('camera')} disabled={pending}>
        <Text style={styles.btnText}>Take photo</Text>
      </Pressable>
      <Pressable style={[styles.btn, styles.btnSecondary]} onPress={() => void pick('library')} disabled={pending}>
        <Text style={[styles.btnText, styles.btnTextSecondary]}>Choose from gallery</Text>
      </Pressable>

      {msg ? <Text style={styles.ok}>{msg}</Text> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  container: { padding: 16, paddingBottom: 40 },
  hint: { fontSize: 13, color: '#6b7280', marginBottom: 12 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    backgroundColor: '#fff',
  },
  btn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    marginBottom: 10,
  },
  btnSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#2d6a4f' },
  btnText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  btnTextSecondary: { color: '#2d6a4f' },
  ok: { color: '#166534', marginTop: 12 },
  error: { color: '#b91c1c', marginTop: 12 },
  muted: { color: '#6b7280' },
});
