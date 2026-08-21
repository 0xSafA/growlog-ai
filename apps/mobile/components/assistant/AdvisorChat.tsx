import { TrustPanel } from '@/components/trust/TrustPanel';
import type { AskResponse, ChatTurn } from '@/lib/advisor-types';
import { useFarmContext } from '@/providers/FarmProvider';
import { askAssistant } from '@growlog/api-client';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const ADVISOR_CONVERSATION_KEY = 'growlog_advisor_conversation_id';

async function getOrCreateConversationId(): Promise<string> {
  try {
    let id = await SecureStore.getItemAsync(ADVISOR_CONVERSATION_KEY);
    if (!id) {
      id = crypto.randomUUID();
      await SecureStore.setItemAsync(ADVISOR_CONVERSATION_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function AdvisorChat() {
  const { supabase, farmId, cycle, primaryScope, loading } = useFarmContext();
  const [text, setText] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const conversationRef = useRef<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const loadHistory = useCallback(async () => {
    if (!farmId) return;
    if (!conversationRef.current) {
      conversationRef.current = await getOrCreateConversationId();
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
    if (turns.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
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
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError('Not signed in');
        return;
      }
      if (!conversationRef.current) {
        conversationRef.current = await getOrCreateConversationId();
      }
      const data = (await askAssistant(token, {
        message: q,
        farmId,
        cycleId: cycle?.id ?? null,
        scopeId: primaryScope?.id ?? null,
        conversationId: conversationRef.current,
      })) as AskResponse & { error?: string; detail?: string };

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
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setPending(false);
    }
  }

  async function newConversation() {
    const id = crypto.randomUUID();
    await SecureStore.setItemAsync(ADVISOR_CONVERSATION_KEY, id);
    conversationRef.current = id;
    setTurns([]);
    setError(null);
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2d6a4f" />
      </View>
    );
  }

  if (!farmId) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>Select a farm in More → Settings.</Text>
      </View>
    );
  }

  const lastAssistant = [...turns].reverse().find((t) => t.role === 'assistant' && t.response);

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={100}
    >
      <View style={styles.banner}>
        <Text style={styles.bannerText}>Answers use farm facts + trust layer</Text>
        <View style={styles.bannerActions}>
          <Pressable onPress={() => void newConversation()}>
            <Text style={styles.link}>New chat</Text>
          </Pressable>
          <Pressable onPress={() => router.push('/(tabs)/timeline')}>
            <Text style={styles.link}>Timeline</Text>
          </Pressable>
        </View>
      </View>

      {!cycle && (
        <Text style={styles.warn}>No active cycle — answers may be limited.</Text>
      )}

      <FlatList
        ref={listRef}
        style={styles.listFlex}
        data={turns}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.muted}>Ask about your grow cycle, SOP, or recent events.</Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.role}>{item.role === 'user' ? 'You' : 'Assistant'}</Text>
            <Text style={styles.bubbleText}>{item.text}</Text>
          </View>
        )}
      />

      {lastAssistant?.response && <TrustPanel response={lastAssistant.response} />}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Ask the farm…"
          value={text}
          onChangeText={setText}
          multiline
          editable={!pending}
        />
        <Pressable
          style={[styles.sendBtn, (pending || !text.trim()) && styles.sendDisabled]}
          onPress={() => void send()}
          disabled={pending || !text.trim()}
        >
          {pending ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.sendText}>Ask</Text>
          )}
        </Pressable>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, paddingBottom: 100 },
  listFlex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  banner: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#bbf7d0',
  },
  bannerText: { fontSize: 13, color: '#166534', flex: 1 },
  bannerActions: { flexDirection: 'row', gap: 16 },
  link: { fontSize: 13, color: '#2d6a4f', fontWeight: '600' },
  warn: {
    marginHorizontal: 12,
    marginTop: 8,
    padding: 10,
    backgroundColor: '#fffbeb',
    color: '#92400e',
    borderRadius: 8,
    fontSize: 13,
  },
  list: { padding: 12, paddingBottom: 8, flexGrow: 1 },
  bubble: { borderRadius: 12, padding: 12, marginBottom: 10, maxWidth: '92%' },
  userBubble: { alignSelf: 'flex-end', backgroundColor: '#dcfce7' },
  aiBubble: { alignSelf: 'flex-start', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb' },
  role: { fontSize: 10, fontWeight: '700', color: '#6b7280', marginBottom: 4, textTransform: 'uppercase' },
  bubbleText: { fontSize: 15, color: '#111827', lineHeight: 21 },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  sendBtn: {
    backgroundColor: '#2d6a4f',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    minWidth: 64,
    alignItems: 'center',
  },
  sendDisabled: { opacity: 0.5 },
  sendText: { color: '#fff', fontWeight: '600' },
  error: { color: '#b91c1c', padding: 12, fontSize: 14 },
  muted: { color: '#6b7280', textAlign: 'center', padding: 24 },
});
