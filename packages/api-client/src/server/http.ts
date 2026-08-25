const apiBase = () =>
  (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').replace(/\/$/, '');

export async function postJson<T>(
  path: string,
  body: unknown,
  token: string
): Promise<T> {
  const base = apiBase();
  if (!base) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured');
  }
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as T & { error?: string; detail?: string };
  if (!res.ok) {
    throw new Error(json.error ?? json.detail ?? `Request failed: ${path}`);
  }
  return json;
}

export async function postBinary(
  path: string,
  body: unknown,
  token: string
): Promise<ArrayBuffer> {
  const base = apiBase();
  if (!base) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL is not configured');
  }
  const res = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `Request failed: ${path}`;
    try {
      const json = (await res.json()) as { error?: string; detail?: string };
      message = json.error ?? json.detail ?? message;
    } catch {
      // binary error body
    }
    throw new Error(message);
  }
  return res.arrayBuffer();
}

export async function speakVoice(token: string, text: string) {
  return postBinary('/api/voice/speak', { text: text.slice(0, 2000) }, token);
}

export async function transcribeVoice(
  token: string,
  params: { audioBase64: string; mimeType: string }
) {
  return postJson<{ text?: string }>('/api/voice/transcribe', params, token);
}

export async function extractVoiceIntent(token: string, transcript: string) {
  return postJson<{
    event_type?: string;
    body?: string;
    title?: string | null;
    occurred_at?: string | null;
  }>('/api/voice/extract', { transcript }, token);
}

export async function askAssistant(
  token: string,
  body: Record<string, unknown>
) {
  return postJson<Record<string, unknown>>('/api/assistant/ask', body, token);
}

export async function materializeSopRuns(
  token: string,
  params: { farmId: string; cycleId: string; anchorDate: string }
) {
  return postJson<unknown>('/api/sop/materialize', params, token);
}

export async function generateReport(
  token: string,
  params: Record<string, unknown>
) {
  return postJson<{ reportId?: string; error?: string; detail?: string }>(
    '/api/reports/generate',
    params,
    token
  );
}
