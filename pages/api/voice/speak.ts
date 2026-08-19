import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI from 'openai';
import { getBearerToken, getUserFromBearer } from '@/lib/api/auth-from-request';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { user, error: authError } = await getUserFromBearer(req);
  if (!user || authError) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!getBearerToken(req)) return res.status(401).json({ error: 'unauthorized' });

  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'openai_not_configured' });
  }

  const body = req.body as { text?: string; voice?: string };
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'missing_text' });
  }

  const voice = body.voice === 'nova' || body.voice === 'onyx' ? body.voice : 'alloy';

  try {
    const speech = await openai.audio.speech.create({
      model: 'tts-1',
      voice,
      input: text.slice(0, 4096),
    });
    const buffer = Buffer.from(await speech.arrayBuffer());
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.status(200).send(buffer);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'tts_failed';
    return res.status(502).json({ error: 'tts_failed', detail: msg });
  }
}
