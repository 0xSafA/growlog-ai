import { useFarmContext } from '@/providers/FarmProvider';
import { extractVoiceIntent, transcribeVoice } from '@growlog/api-client';
import { createLogEntry, type EventType } from '@growlog/domain';
import { uriToBase64 } from '@/lib/uri-to-base64';
import { Audio } from 'expo-av';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type Step = 'idle' | 'recording' | 'processing' | 'review';

const MAX_MS = 120_000;

export default function VoiceCaptureScreen() {
  const { supabase, farmId, cycle, primaryScope, userId, refetchAll } = useFarmContext();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [eventType, setEventType] = useState<EventType>('note');
  const [body, setBody] = useState('');
  const [savePending, setSavePending] = useState(false);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void recordingRef.current?.stopAndUnloadAsync();
    };
  }, []);

  const runPipeline = useCallback(
    async (uri: string) => {
      setStep('processing');
      setError(null);
      try {
        const base64 = await uriToBase64(uri);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Not signed in');

        const tr = await transcribeVoice(token, {
          audioBase64: base64,
          mimeType: 'audio/m4a',
        });
        const text = tr.text?.trim() ?? '';
        setTranscript(text);
        if (!text) throw new Error('Empty transcript');

        const ex = await extractVoiceIntent(token, text);
        const type = (ex.event_type as EventType | undefined) ?? 'note';
        setEventType(type);
        setBody(ex.body?.trim() || text);
        setStep('review');
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'Voice processing failed');
        setStep('idle');
      }
    },
    [supabase]
  );

  const stopRecording = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const rec = recordingRef.current;
    if (!rec) return;
    recordingRef.current = null;
    await rec.stopAndUnloadAsync();
    const uri = rec.getURI();
    if (!uri) {
      setError('No recording file');
      setStep('idle');
      return;
    }
    await runPipeline(uri);
  }, [runPipeline]);

  async function startRecording() {
    setError(null);
    const perm = await Audio.requestPermissionsAsync();
    if (!perm.granted) {
      setError('Microphone permission required');
      return;
    }
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });
    const { recording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recordingRef.current = recording;
    setStep('recording');
    timerRef.current = setTimeout(() => {
      void stopRecording();
    }, MAX_MS);
  }

  async function save() {
    if (!farmId || !cycle || !primaryScope || !body.trim()) return;
    setSavePending(true);
    setError(null);
    try {
      await createLogEntry(supabase, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        eventType,
        body: body.trim(),
        occurredAt: new Date().toISOString(),
        sourceType: 'user_voice',
        createdBy: userId,
        payload: transcript ? { voice: { transcript } } : undefined,
      });
      await refetchAll();
      router.back();
      router.back();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSavePending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return (
      <View style={styles.center}>
        <Text>Complete onboarding first.</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {step === 'idle' && (
        <Pressable style={styles.recordBtn} onPress={() => void startRecording()}>
          <Text style={styles.recordBtnText}>Start recording</Text>
        </Pressable>
      )}

      {step === 'recording' && (
        <>
          <Text style={styles.recordingLabel}>Recording…</Text>
          <Pressable style={styles.stopBtn} onPress={() => void stopRecording()}>
            <Text style={styles.recordBtnText}>Stop</Text>
          </Pressable>
        </>
      )}

      {step === 'processing' && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#2d6a4f" />
          <Text style={styles.muted}>Transcribing…</Text>
        </View>
      )}

      {step === 'review' && (
        <>
          <Text style={styles.label}>Transcript</Text>
          <Text style={styles.transcript}>{transcript}</Text>
          <Text style={styles.label}>Event type: {eventType}</Text>
          <TextInput style={styles.input} multiline value={body} onChangeText={setBody} />
          <Pressable
            style={[styles.recordBtn, savePending && styles.disabled]}
            onPress={() => void save()}
            disabled={savePending}
          >
            <Text style={styles.recordBtnText}>{savePending ? 'Saving…' : 'Confirm & save'}</Text>
          </Pressable>
        </>
      )}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {!process.env.EXPO_PUBLIC_API_BASE_URL && step === 'idle' && (
        <Text style={styles.hint}>
          Set EXPO_PUBLIC_API_BASE_URL to your Next.js dev server (e.g. http://localhost:3000) for
          voice transcribe/extract.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, flexGrow: 1 },
  center: { alignItems: 'center', padding: 24 },
  recordBtn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 24,
  },
  stopBtn: {
    backgroundColor: '#b91c1c',
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 16,
  },
  recordBtnText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  recordingLabel: { textAlign: 'center', fontSize: 16, color: '#b91c1c', marginTop: 24 },
  muted: { marginTop: 12, color: '#6b7280' },
  label: { fontWeight: '600', marginTop: 16, marginBottom: 6 },
  transcript: { backgroundColor: '#f3f4f6', padding: 12, borderRadius: 8, fontSize: 14 },
  input: {
    minHeight: 100,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    textAlignVertical: 'top',
  },
  error: { color: '#b91c1c', marginTop: 16 },
  hint: { fontSize: 12, color: '#9ca3af', marginTop: 24, lineHeight: 18 },
  disabled: { opacity: 0.6 },
});
