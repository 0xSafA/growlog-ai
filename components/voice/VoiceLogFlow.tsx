'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { createLogEntry } from '@/lib/growlog/mutations';
import { VOICE_EXTRACTABLE_EVENT_TYPES } from '@/lib/voice/extractable-event-types';
import type { VoiceExtractionResult } from '@/lib/voice/extraction-schema';
import type { EventType, SourceType } from '@/types/domain';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Mic, Square } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { arrayBufferToBase64 } from '@/lib/voice/buffer-to-base64';

type Step = 'idle' | 'recording' | 'processing' | 'review';

const MAX_MS = 120_000;

export function VoiceLogFlow() {
  const { supabase, farmId, cycle, primaryScope, refetchAll, userId } = useFarmContext();
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState('');
  const [extracted, setExtracted] = useState<VoiceExtractionResult | null>(null);
  const [modelLabel, setModelLabel] = useState<string | null>(null);
  const [eventType, setEventType] = useState<EventType>('note');
  const [body, setBody] = useState('');
  const [title, setTitle] = useState('');
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [savePending, setSavePending] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
      return;
    }
    stopTracks();
    mediaRecorderRef.current = null;
  }, [stopTracks]);

  const runPipeline = useCallback(
    async (blob: Blob) => {
      setStep('processing');
      setError(null);
      try {
        const buf = await blob.arrayBuffer();
        const audioBase64 = arrayBufferToBase64(buf);
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error('Нет сессии');

        const trRes = await fetch('/api/voice/transcribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            audioBase64,
            mimeType: blob.type || 'audio/webm',
          }),
        });
        const trJson = (await trRes.json()) as { text?: string; error?: string; detail?: string };
        if (!trRes.ok) {
          throw new Error(trJson.error ?? trJson.detail ?? 'Транскрибация не удалась');
        }
        const text = trJson.text?.trim() ?? '';
        setTranscript(text);

        const exRes = await fetch('/api/voice/extract', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ transcript: text }),
        });
        const exJson = (await exRes.json()) as VoiceExtractionResult & {
          error?: string;
          detail?: string;
          model?: string;
        };
        if (!exRes.ok) {
          throw new Error(exJson.detail ?? exJson.error ?? 'Разбор события не удался');
        }

        setExtracted({
          event_type: exJson.event_type,
          body: exJson.body,
          title: exJson.title,
          occurred_at_iso: exJson.occurred_at_iso,
        });
        setModelLabel(exJson.model ?? null);
        setEventType(exJson.event_type);
        setBody(exJson.body);
        setTitle(exJson.title ?? '');
        if (exJson.occurred_at_iso) {
          const d = new Date(exJson.occurred_at_iso);
          if (!Number.isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0');
            const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
            setOccurredAt(local);
          }
        } else {
          setOccurredAt(new Date().toISOString().slice(0, 16));
        }
        setStep('review');
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Ошибка');
        setStep('idle');
      }
    },
    [supabase]
  );

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript('');
    setExtracted(null);
    chunksRef.current = [];

    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Браузер не поддерживает запись с микрофона');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : 'audio/mp4';

      const mr = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mr;
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        chunksRef.current = [];
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        mediaRecorderRef.current = null;
        void runPipeline(blob);
      };

      setStep('recording');
      mr.start(200);

      timerRef.current = setTimeout(() => {
        stopRecording();
      }, MAX_MS);
    } catch {
      setError('Не удалось получить доступ к микрофону');
    }
  }, [runPipeline, stopRecording]);

  async function confirmSave(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !cycle || !primaryScope) return;
    setSavePending(true);
    setError(null);
    try {
      const iso = new Date(occurredAt).toISOString();
      await createLogEntry(supabase, {
        farmId,
        cycleId: cycle.id,
        scopeId: primaryScope.id,
        eventType,
        body: body.trim(),
        occurredAt: iso,
        sourceType: 'user_voice' as SourceType,
        createdBy: userId,
        payload: {
          voice: {
            transcript,
            extraction_model: modelLabel,
            title: title.trim() || null,
          },
        },
      });
      setStep('idle');
      setTranscript('');
      setExtracted(null);
      setBody('');
      setTitle('');
      await refetchAll();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Сохранение не удалось');
    } finally {
      setSavePending(false);
    }
  }

  if (!cycle || !primaryScope) {
    return <p className="text-muted-foreground">Сначала завершите онбординг с циклом.</p>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Голосовая запись</CardTitle>
        <CardDescription>
          Этап 2 ADR-001: Whisper → структура → вы правите → сохранение в журнал (без автозаписи фактов).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 'idle' && (
          <div className="flex flex-col items-center gap-4 py-4">
            <Button type="button" size="lg" className="gap-2" onClick={() => void startRecording()}>
              <Mic className="h-5 w-5" />
              Начать запись
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              До {MAX_MS / 1000} с, формат WebM. Нужен OPENAI_API_KEY на сервере.
            </p>
          </div>
        )}

        {step === 'recording' && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/20 animate-pulse">
              <Mic className="h-8 w-8 text-destructive" />
            </div>
            <p className="text-sm font-medium">Идёт запись…</p>
            <Button type="button" variant="secondary" className="gap-2" onClick={stopRecording}>
              <Square className="h-4 w-4" />
              Стоп и разобрать
            </Button>
          </div>
        )}

        {step === 'processing' && (
          <p className="py-8 text-center text-muted-foreground">
            Транскрибация и разбор события…
          </p>
        )}

        {step === 'review' && extracted && (
          <form onSubmit={confirmSave} className="space-y-4">
            <div className="rounded-md border border-border/80 bg-muted/30 p-3 text-sm">
              <p className="text-xs font-medium text-muted-foreground">Расшифровка</p>
              <p className="mt-1 whitespace-pre-wrap">{transcript}</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Тип события (проверьте)</label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={eventType}
                onChange={(e) => setEventType(e.target.value as EventType)}
              >
                {VOICE_EXTRACTABLE_EVENT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Текст в журнал</label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Заголовок (опционально)</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Когда (локальное время)</label>
              <Input
                type="datetime-local"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={savePending}>
                {savePending ? 'Сохранение…' : 'Подтвердить и записать в журнал'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setStep('idle');
                  setExtracted(null);
                }}
              >
                Отмена
              </Button>
            </div>
          </form>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
