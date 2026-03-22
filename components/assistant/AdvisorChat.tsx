'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRef, useState } from 'react';
import { AlertTriangle, ListTree, Loader2, Send } from 'lucide-react';
import Link from 'next/link';

const ADVISOR_CONVERSATION_KEY = 'growlog_advisor_conversation_id';

function getOrCreateAdvisorConversationId(): string {
  if (typeof window === 'undefined') return '';
  try {
    let id = sessionStorage.getItem(ADVISOR_CONVERSATION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem(ADVISOR_CONVERSATION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

type AskResponse = {
  insightId: string | null;
  persisted?: boolean;
  persistDetail?: string;
  groundingPersisted?: boolean;
  groundingError?: string;
  model: string;
  insight_type: string;
  title: string | null;
  body: string;
  facts: string[];
  interpretation: string | null;
  hypotheses: string[];
  recommendation: string | null;
  confidence: { score: number; label: string };
  missing_data: string[];
  grounding: {
    source_type: string;
    source_id: string | null;
    excerpt: string | null;
  }[];
  trust_flags: string[];
};

export function AdvisorChat() {
  const { supabase, farmId, cycle, primaryScope, loading } = useFarmContext();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<AskResponse | null>(null);
  const conversationRef = useRef<string | null>(null);

  async function send() {
    const q = text.trim();
    if (!q || !farmId || pending) return;
    setPending(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError('Нет сессии');
        return;
      }
      if (!conversationRef.current) {
        conversationRef.current = getOrCreateAdvisorConversationId();
      }
      const res = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: q,
          farmId,
          cycleId: cycle?.id ?? null,
          scopeId: primaryScope?.id ?? null,
          conversationId: conversationRef.current,
        }),
      });
      const data = (await res.json()) as AskResponse & { error?: string; detail?: string };
      if (!res.ok) {
        setError(data.detail || data.error || `Ошибка ${res.status}`);
        return;
      }
      setLast(data);
      setText('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Сеть');
    } finally {
      setPending(false);
    }
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">Загрузка…</p>;
  }

  if (!farmId) {
    return <p className="text-muted-foreground text-sm">Выберите ферму в шапке.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">
          Режим: спросить и понять. Факты смотрите в таймлайне.
        </span>
        <Button variant="ghost" size="sm" className="h-8 shrink-0" asChild>
          <Link href="/timeline">
            <ListTree className="mr-1.5 h-4 w-4" />
            Таймлайн
          </Link>
        </Button>
      </div>

      {!cycle && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Нет активного цикла — контекст ограничен общими данными фермы. Создайте цикл в настройках или
          онбординге.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Вопрос ассистенту</CardTitle>
          <CardDescription>
            Ответ строится по журналу, сенсорам и открытым SOP этой фермы (retrieval + trust layer).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder="Например: что важно учесть по VPD за последние дни?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={pending}
          />
          <Button type="button" onClick={() => void send()} disabled={pending || !text.trim()}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Думаю…
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Спросить
              </>
            )}
          </Button>
          {error && (
            <p className="text-sm text-destructive flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </p>
          )}
        </CardContent>
      </Card>

      {last && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {last.title ?? 'Ответ'}{' '}
              <span className="text-muted-foreground font-normal text-sm">
                ({last.insight_type}) · {last.model}
              </span>
            </CardTitle>
            {last.persisted === false && (
              <CardDescription className="text-amber-600 dark:text-amber-400">
                Не сохранено в БД: {last.persistDetail ?? 'проверьте миграцию ai_insights'}
              </CardDescription>
            )}
            {last.groundingPersisted === false && last.groundingError && (
              <CardDescription className="text-amber-600 dark:text-amber-400">
                Grounding не сохранён: {last.groundingError}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div className="whitespace-pre-wrap">{last.body}</div>
            </div>

            <div className="flex flex-wrap gap-2 items-center text-xs">
              <span className="text-muted-foreground">Уверенность:</span>
              <span className="rounded-full bg-muted px-2 py-0.5">
                {last.confidence.label} ({Math.round(last.confidence.score * 100)}%)
              </span>
            </div>

            {last.facts.length > 0 && (
              <div>
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Факты
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {last.facts.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {last.interpretation && (
              <div>
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Интерпретация
                </p>
                <p className="whitespace-pre-wrap">{last.interpretation}</p>
              </div>
            )}

            {last.hypotheses.length > 0 && (
              <div>
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Гипотезы
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {last.hypotheses.map((h, i) => (
                    <li key={i}>{h}</li>
                  ))}
                </ul>
              </div>
            )}

            {last.recommendation && (
              <div>
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Рекомендация
                </p>
                <p className="whitespace-pre-wrap">{last.recommendation}</p>
              </div>
            )}

            {last.missing_data.length > 0 && (
              <div>
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Не хватает данных
                </p>
                <ul className="list-disc pl-5 space-y-1">
                  {last.missing_data.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {last.trust_flags.length > 0 && (
              <div>
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Trust flags
                </p>
                <div className="flex flex-wrap gap-1">
                  {last.trust_flags.map((t) => (
                    <span key={t} className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {last.grounding.length > 0 && (
              <div>
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Grounding
                </p>
                <ul className="space-y-2">
                  {last.grounding.map((g, i) => (
                    <li key={i} className="rounded border border-border/60 px-2 py-1.5 text-xs">
                      <span className="font-mono text-[11px]">
                        {g.source_type}
                        {g.source_id ? ` · ${g.source_id}` : ''}
                      </span>
                      {g.excerpt && <p className="mt-1 text-foreground/90">{g.excerpt}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {last.insightId && (
              <p className="text-xs text-muted-foreground font-mono">insight: {last.insightId}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
