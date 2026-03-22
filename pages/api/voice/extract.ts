import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { getUserFromBearer } from '@/lib/api/auth-from-request';
import { VOICE_EXTRACTABLE_EVENT_TYPES } from '@/lib/voice/extractable-event-types';
import { parseVoiceExtractionJson } from '@/lib/voice/extraction-schema';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM = `Ты помощник агронома-журнала. По расшифровке речи пользователя определи одно событие для журнала выращивания.
Верни ТОЛЬКО JSON без markdown:
{
  "event_type": "<одно из списка>",
  "body": "<факты своими словами, кратко, на языке исходной речи>",
  "title": null или короткий заголовок,
  "occurred_at_iso": null или ISO 8601 если в речи явно названо время ("вчера в 8" — оцени дату) иначе null
}

Допустимые event_type (строго из списка, snake_case):
${VOICE_EXTRACTABLE_EVENT_TYPES.join(', ')}

Правила:
- Не выдумывай измерения и факты, которых нет в речи.
- Если неясно — используй "note" и опиши неопределённость в body.
- body — это содержание записи, не повторяй дословно всю простыню если можно сжать.`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'openai_not_configured' });
  }

  const { user, error: authError } = await getUserFromBearer(req);
  if (!user || authError) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const { transcript } = req.body as { transcript?: string };
  if (!transcript || typeof transcript !== 'string' || !transcript.trim()) {
    return res.status(400).json({ error: 'missing_transcript' });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.15,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: transcript.trim() },
      ],
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      return res.status(502).json({ error: 'empty_model_response' });
    }

    const parsed = parseVoiceExtractionJson(raw);
    return res.status(200).json({
      ...parsed,
      model: 'gpt-4o-mini',
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'extraction_failed';
    return res.status(422).json({ error: 'extraction_failed', detail: msg });
  }
}
