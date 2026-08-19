'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useCallback, useEffect, useRef, useState } from 'react';
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

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  response?: AskResponse;
};

export function AdvisorChat() {
  const { supabase, farmId, cycle, primaryScope, loading } = useFarmContext();
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const conversationRef = useRef<string | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadHistory = useCallback(async () => {
    if (!farmId) return;
    if (!conversationRef.current) {
      conversationRef.current = getOrCreateAdvisorConversationId();
    }
    const { data, error: histErr } = await supabase
      .from('conversation_messages')
      .select('id, role, message_text, created_at')
      .eq('farm_id', farmId)
      .eq('conversation_id', conversationRef.current)
      .order('created_at', { ascending: true })
      .limit(40);
    if (histErr || !data?.length) return;

    const loaded: ChatTurn[] = [];
    for (const row of data) {
      const r = row as { id: string; role: string; message_text: string | null };
      if (!r.message_text) continue;
      loaded.push({
        id: r.id,
        role: r.role as 'user' | 'assistant',
        text: r.message_text,
      });
    }
    if (loaded.length) setTurns(loaded);
  }, [farmId, supabase]);

  useEffect(() => {
    if (farmId && !loading) void loadHistory();
  }, [farmId, loading, loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, pending]);

  async function send() {
    const q = text.trim();
    if (!q || !farmId || pending) return;
    setPending(true);
    setError(null);
    const userTurn: ChatTurn = { id: `local-u-${Date.now()}`, role: 'user', text: q };
    setTurns((prev) => [...prev, userTurn]);
    setText('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) {
        setError(t('advisor.noSession'));
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
        setError(data.detail || data.error || t('advisor.errorStatus', { status: res.status }));
        return;
      }
      setTurns((prev) => [
        ...prev,
        {
          id: `local-a-${Date.now()}`,
          role: 'assistant',
          text: data.body,
          response: data,
        },
      ]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('common.network'));
    } finally {
      setPending(false);
    }
  }

  function newConversation() {
    const id = crypto.randomUUID();
    sessionStorage.setItem(ADVISOR_CONVERSATION_KEY, id);
    conversationRef.current = id;
    setTurns([]);
    setError(null);
  }

  if (loading) {
    return <p className="text-muted-foreground text-sm">{t('advisor.loading')}</p>;
  }

  if (!farmId) {
    return <p className="text-muted-foreground text-sm">{t('common.selectFarm')}</p>;
  }

  const lastAssistant = [...turns].reverse().find((t) => t.role === 'assistant' && t.response);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-sm">
        <span className="text-muted-foreground">{t('advisor.banner')}</span>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" className="h-8 shrink-0" type="button" onClick={newConversation}>
            {t('advisor.newChat')}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 shrink-0" asChild>
            <Link href="/timeline">
              <ListTree className="mr-1.5 h-4 w-4" />
              {t('nav.timeline')}
            </Link>
          </Button>
        </div>
      </div>

      {!cycle && (
        <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          {t('advisor.noCycle')}
        </p>
      )}

      {turns.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t('advisor.history')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 max-h-[420px] overflow-y-auto text-sm">
            {turns.map((turn) => (
              <div
                key={turn.id}
                className={
                  turn.role === 'user'
                    ? 'ml-4 rounded-lg bg-primary/10 px-3 py-2'
                    : 'mr-4 rounded-lg border border-border/60 px-3 py-2'
                }
              >
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                  {turn.role === 'user' ? t('advisor.you') : t('advisor.assistant')}
                </p>
                <p className="whitespace-pre-wrap">{turn.text}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t('advisor.askTitle')}</CardTitle>
          <CardDescription>{t('advisor.askDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <textarea
            className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={t('advisor.placeholder')}
            value={text}
            onChange={(e) => setText(e.target.value)}
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send();
            }}
          />
          <Button type="button" onClick={() => void send()} disabled={pending || !text.trim()}>
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('advisor.thinking')}
              </>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                {t('advisor.ask')}
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

      {lastAssistant?.response && (
        <AssistantDetail response={lastAssistant.response} />
      )}
    </div>
  );
}

function AssistantDetail({ response: last }: { response: AskResponse }) {
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          {last.title ?? t('advisor.responseDetails')}{' '}
          <span className="text-muted-foreground font-normal text-sm">
            ({last.insight_type}) · {last.model}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="flex flex-wrap gap-2 items-center text-xs">
          <span className="text-muted-foreground">{t('dailyFocus.confidence')}</span>
          <span className="rounded-full bg-muted px-2 py-0.5">
            {last.confidence.label} ({Math.round(last.confidence.score * 100)}%)
          </span>
        </div>
        {last.facts.length > 0 && (
          <div>
            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">{t('advisor.facts')}</p>
            <ul className="list-disc pl-5 space-y-1">
              {last.facts.map((f, i) => (
                <li key={i}>{f}</li>
              ))}
            </ul>
          </div>
        )}
        {last.recommendation && (
          <div>
            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {t('advisor.recommendation')}
            </p>
            <p className="whitespace-pre-wrap">{last.recommendation}</p>
          </div>
        )}
        {last.missing_data.length > 0 && (
          <div>
            <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
              {t('advisor.missingData')}
            </p>
            <ul className="list-disc pl-5 space-y-1">
              {last.missing_data.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
