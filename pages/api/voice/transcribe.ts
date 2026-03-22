import type { NextApiRequest, NextApiResponse } from 'next';
import OpenAI, { toFile } from 'openai';
import { getUserFromBearer } from '@/lib/api/auth-from-request';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '12mb',
    },
  },
};

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

  const { audioBase64, mimeType } = req.body as {
    audioBase64?: string;
    mimeType?: string;
  };

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    return res.status(400).json({ error: 'missing_audio' });
  }

  const mt = typeof mimeType === 'string' && mimeType ? mimeType : 'audio/webm';
  let buffer: Buffer;
  try {
    buffer = Buffer.from(audioBase64, 'base64');
  } catch {
    return res.status(400).json({ error: 'invalid_base64' });
  }

  if (buffer.length < 100) {
    return res.status(400).json({ error: 'audio_too_short' });
  }

  if (buffer.length > 10 * 1024 * 1024) {
    return res.status(413).json({ error: 'audio_too_large' });
  }

  const ext = mt.includes('mp4') ? 'm4a' : mt.includes('webm') ? 'webm' : 'webm';
  const file = await toFile(buffer, `recording.${ext}`, { type: mt });

  try {
    const transcription = await openai.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      language: 'ru',
    });
    const text = transcription.text?.trim() ?? '';
    if (!text) {
      return res.status(422).json({ error: 'empty_transcription' });
    }
    return res.status(200).json({ text });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'transcription_failed';
    return res.status(502).json({ error: 'transcription_failed', detail: msg });
  }
}
