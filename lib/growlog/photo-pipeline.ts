import OpenAI from 'openai';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { BackgroundJobRow } from '@/types/background-jobs';
import {
  DEFAULT_PHOTO_ANALYSIS_VERSION,
  MAX_PHOTO_BYTES_VISION,
} from '@/lib/growlog/photo-constants';

const VISION_MODEL = 'gpt-4o-mini';
const TEXT_MODEL = 'gpt-4o-mini';

const ANALYSIS_SYSTEM = `You are a greenhouse / indoor farm vision assistant. Output MUST be valid JSON only, no markdown.
Rules:
- Describe only what is plausibly visible; use cautious, observation-style language in summary_text (Russian).
- tags: 3–12 short lowercase tokens (Latin or Russian).
- signals: a flat JSON object of optional visual cues (strings or numbers), e.g. {"canopy_density":"medium","leaf_color":"yellowing_tips"}.
- issues_detected: array of { "code": string, "note": string } for possible issues — hypotheses, not diagnoses.
- confidence: number 0–1 for overall visual assessment confidence.
Never claim guaranteed pest/disease identity; stay hypothesis-level.`;

const TIMELINE_SYSTEM = `You compare two farm photo analyses (older frame -> newer frame). Output JSON only.
Fields:
- signal_type: one of color_shift | leaf_drop | growth_change | density_change | suspected_stress | general
- signal_strength: 0..1
- description: short Russian text, hypothesis-style ("похоже на...", "визуально заметен...")
- correlated_factors: object with optional keys referencing context (not causal claims), e.g. {"notes":"..."}
If changes are unclear or data insufficient, use signal_type "general", low strength (<=0.35), and explain uncertainty in description.`;

type VisionAnalysisJson = {
  summary_text?: string;
  tags?: string[];
  signals?: Record<string, unknown>;
  issues_detected?: unknown[];
  confidence?: number;
};

type TimelineJson = {
  signal_type?: string;
  signal_strength?: number;
  description?: string;
  correlated_factors?: Record<string, unknown>;
};

function getOpenAI(): OpenAI {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not set (required for photo.analyze / photo.timeline.refresh)');
  }
  return new OpenAI({ apiKey: key });
}

function parseJsonObject<T>(raw: string): T {
  const t = raw.trim();
  const parsed = JSON.parse(t) as T;
  return parsed;
}

async function enqueueTimelineRefresh(
  supabase: SupabaseClient,
  params: {
    farmId: string;
    cycleId: string | null;
    scopeId: string | null;
    anchorMediaAssetId: string;
  }
) {
  const dedupKey = `photo.timeline.refresh:${params.anchorMediaAssetId}`;
  const { data: pendingSame } = await supabase
    .from('background_jobs')
    .select('id')
    .eq('farm_id', params.farmId)
    .eq('dedup_key', dedupKey)
    .in('status', ['pending', 'running', 'retrying'])
    .maybeSingle();
  if (pendingSame?.id) {
    return { job_id: pendingSame.id as string, deduped: true as const };
  }

  const { data, error } = await supabase
    .from('background_jobs')
    .insert({
      job_type: 'photo.timeline.refresh',
      status: 'pending',
      priority: 'normal',
      farm_id: params.farmId,
      cycle_id: params.cycleId,
      scope_id: params.scopeId,
      entity_type: 'media_asset',
      entity_id: params.anchorMediaAssetId,
      scheduled_for: new Date().toISOString(),
      dedup_key: dedupKey,
      payload_json: {
        anchor_media_asset_id: params.anchorMediaAssetId,
        reason: 'post_analyze',
      },
    })
    .select('id')
    .single();
  if (error) throw error;
  return { job_id: data!.id as string, deduped: false as const };
}

export async function processPhotoAnalyzeJob(
  supabase: SupabaseClient,
  job: BackgroundJobRow
): Promise<Record<string, unknown>> {
  const farmId = job.farm_id;
  const payload = job.payload_json ?? {};
  const mediaAssetId = (payload.media_asset_id as string) ?? job.entity_id;
  const analysisVersion =
    typeof payload.analysis_version === 'string' && payload.analysis_version.trim()
      ? payload.analysis_version.trim()
      : DEFAULT_PHOTO_ANALYSIS_VERSION;

  if (!mediaAssetId) {
    throw new Error('photo.analyze: media_asset_id missing');
  }

  const { data: existingRow } = await supabase
    .from('photo_analysis')
    .select('id')
    .eq('media_asset_id', mediaAssetId)
    .eq('analysis_version', analysisVersion)
    .maybeSingle();

  if (existingRow?.id) {
    await supabase
      .from('media_assets')
      .update({ analysis_status: 'analysis_ready' })
      .eq('id', mediaAssetId)
      .eq('farm_id', farmId);

    const { data: meta } = await supabase
      .from('media_assets')
      .select('cycle_id, scope_id')
      .eq('id', mediaAssetId)
      .eq('farm_id', farmId)
      .maybeSingle();

    const timeline = await enqueueTimelineRefresh(supabase, {
      farmId,
      cycleId: meta?.cycle_id ?? null,
      scopeId: meta?.scope_id ?? null,
      anchorMediaAssetId: mediaAssetId,
    });

    return {
      skipped: true,
      reason: 'idempotent_hit',
      photo_analysis_id: existingRow.id,
      analysis_version: analysisVersion,
      timeline_refresh: timeline,
    };
  }

  const { data: asset, error: assetErr } = await supabase
    .from('media_assets')
    .select(
      'id, farm_id, cycle_id, scope_id, zone_id, plant_id, storage_bucket, storage_path, mime_type, media_type, captured_at, created_at, file_size'
    )
    .eq('id', mediaAssetId)
    .eq('farm_id', farmId)
    .maybeSingle();

  if (assetErr) throw assetErr;
  if (!asset || asset.media_type !== 'image') {
    throw new Error('photo.analyze: media asset not found or not an image');
  }

  if (
    asset.file_size != null &&
    Number(asset.file_size) > MAX_PHOTO_BYTES_VISION
  ) {
    throw new Error(
      `photo.analyze: file too large (${asset.file_size} bytes, max ${MAX_PHOTO_BYTES_VISION}); compress or resize before upload`
    );
  }

  await supabase
    .from('media_assets')
    .update({ analysis_status: 'processing_analysis' })
    .eq('id', mediaAssetId)
    .eq('farm_id', farmId);

  try {
    const { data: file, error: dlErr } = await supabase.storage
      .from(asset.storage_bucket)
      .download(asset.storage_path);
    if (dlErr || !file) {
      throw new Error(dlErr?.message || 'storage download failed');
    }

    const buf = Buffer.from(await file.arrayBuffer());
    if (buf.length > MAX_PHOTO_BYTES_VISION) {
      throw new Error(
        `photo.analyze: downloaded blob exceeds max ${MAX_PHOTO_BYTES_VISION} bytes (metadata may be missing file_size)`
      );
    }
    const mime = asset.mime_type || 'image/jpeg';
    const dataUrl = `data:${mime};base64,${buf.toString('base64')}`;

    const openai = getOpenAI();
    const completion = await openai.chat.completions.create({
      model: VISION_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Проанализируй это фото растения / тента / зоны выращивания.' },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      throw new Error('empty model output');
    }

    const parsed = parseJsonObject<VisionAnalysisJson>(raw);
    const summaryText =
      typeof parsed.summary_text === 'string' ? parsed.summary_text.trim().slice(0, 4000) : null;
    const tags = Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === 'string').slice(0, 24)
      : [];
    const signals =
      parsed.signals && typeof parsed.signals === 'object' && !Array.isArray(parsed.signals)
        ? (parsed.signals as Record<string, unknown>)
        : {};
    const issues = Array.isArray(parsed.issues_detected) ? parsed.issues_detected : [];
    const confidence =
      typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
        ? Math.min(1, Math.max(0, parsed.confidence))
        : null;

    const { data: upserted, error: upErr } = await supabase
      .from('photo_analysis')
      .upsert(
        {
          farm_id: farmId,
          media_asset_id: mediaAssetId,
          cycle_id: asset.cycle_id,
          zone_id: asset.zone_id,
          scope_id: asset.scope_id,
          plant_id: asset.plant_id,
          analysis_version: analysisVersion,
          summary_text: summaryText,
          tags,
          signals,
          issues_detected: issues as unknown[],
          confidence,
        },
        { onConflict: 'media_asset_id,analysis_version' }
      )
      .select('id')
      .single();

    if (upErr) throw upErr;

    await supabase
      .from('media_assets')
      .update({ analysis_status: 'analysis_ready' })
      .eq('id', mediaAssetId)
      .eq('farm_id', farmId);

    const timeline = await enqueueTimelineRefresh(supabase, {
      farmId,
      cycleId: asset.cycle_id,
      scopeId: asset.scope_id,
      anchorMediaAssetId: mediaAssetId,
    });

    return {
      photo_analysis_id: upserted?.id,
      analysis_version: analysisVersion,
      timeline_refresh: timeline,
    };
  } catch (e: unknown) {
    await supabase
      .from('media_assets')
      .update({ analysis_status: 'analysis_failed' })
      .eq('id', mediaAssetId)
      .eq('farm_id', farmId);
    throw e;
  }
}

export async function processPhotoTimelineRefreshJob(
  supabase: SupabaseClient,
  job: BackgroundJobRow
): Promise<Record<string, unknown>> {
  const farmId = job.farm_id;
  const payload = job.payload_json ?? {};
  const anchorId =
    (payload.anchor_media_asset_id as string) ?? job.entity_id ?? payload.media_asset_id;
  const analysisVersion =
    typeof payload.analysis_version === 'string' && payload.analysis_version.trim()
      ? payload.analysis_version.trim()
      : DEFAULT_PHOTO_ANALYSIS_VERSION;

  if (!anchorId || typeof anchorId !== 'string') {
    throw new Error('photo.timeline.refresh: anchor media id missing');
  }

  const { data: anchor, error: aErr } = await supabase
    .from('media_assets')
    .select('id, farm_id, cycle_id, scope_id, zone_id, plant_id, captured_at, created_at')
    .eq('id', anchorId)
    .eq('farm_id', farmId)
    .maybeSingle();
  if (aErr) throw aErr;
  if (!anchor) {
    throw new Error('photo.timeline.refresh: anchor not found');
  }

  const anchorT = anchor.captured_at ?? anchor.created_at;
  if (!anchorT) {
    return { skipped: true, reason: 'no_timestamp_on_anchor' };
  }

  let prevQuery = supabase
    .from('media_assets')
    .select('id, farm_id, cycle_id, scope_id, plant_id, captured_at, created_at')
    .eq('farm_id', farmId)
    .eq('media_type', 'image')
    .neq('id', anchorId)
    .not('captured_at', 'is', null)
    .lt('captured_at', anchorT)
    .order('captured_at', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1);
  if (anchor.cycle_id) {
    prevQuery = prevQuery.eq('cycle_id', anchor.cycle_id);
  } else {
    prevQuery = prevQuery.is('cycle_id', null);
  }
  if (anchor.scope_id) {
    prevQuery = prevQuery.eq('scope_id', anchor.scope_id);
  } else {
    prevQuery = prevQuery.is('scope_id', null);
  }

  let { data: prevList, error: pErr } = await prevQuery;
  if (pErr) throw pErr;

  /** Legacy rows without captured_at: newest older by created_at within same cycle/scope. */
  if (!(prevList ?? []).length) {
    let fb = supabase
      .from('media_assets')
      .select('id, farm_id, cycle_id, scope_id, plant_id, captured_at, created_at')
      .eq('farm_id', farmId)
      .eq('media_type', 'image')
      .neq('id', anchorId)
      .is('captured_at', null)
      .lt('created_at', anchor.created_at)
      .order('created_at', { ascending: false })
      .limit(1);
    if (anchor.cycle_id) {
      fb = fb.eq('cycle_id', anchor.cycle_id);
    } else {
      fb = fb.is('cycle_id', null);
    }
    if (anchor.scope_id) {
      fb = fb.eq('scope_id', anchor.scope_id);
    } else {
      fb = fb.is('scope_id', null);
    }
    const fbRes = await fb;
    if (fbRes.error) throw fbRes.error;
    prevList = fbRes.data;
  }

  const prev = (prevList ?? [])[0] as
    | {
        id: string;
        farm_id: string;
        cycle_id: string | null;
        scope_id: string | null;
        captured_at: string | null;
        created_at: string;
      }
    | undefined;
  if (!prev) {
    return { skipped: true, reason: 'no_previous_frame' };
  }

  const { data: analyses, error: anErr } = await supabase
    .from('photo_analysis')
    .select('media_asset_id, summary_text, tags, signals, analysis_version')
    .eq('farm_id', farmId)
    .eq('analysis_version', analysisVersion)
    .in('media_asset_id', [prev.id, anchor.id]);
  if (anErr) throw anErr;

  const byMedia = new Map<string, (typeof analyses)[0]>();
  for (const row of analyses ?? []) {
    byMedia.set(row.media_asset_id, row);
  }
  const aPrev = byMedia.get(prev.id);
  const aAnchor = byMedia.get(anchor.id);
  if (!aPrev?.summary_text || !aAnchor?.summary_text) {
    return { skipped: true, reason: 'missing_photo_analysis' };
  }

  const openai = getOpenAI();
  const userPrompt = JSON.stringify(
    {
      older: {
        media_asset_id: prev.id,
        summary: aPrev.summary_text,
        tags: aPrev.tags,
        signals: aPrev.signals,
      },
      newer: {
        media_asset_id: anchor.id,
        summary: aAnchor.summary_text,
        tags: aAnchor.tags,
        signals: aAnchor.signals,
      },
    },
    null,
    2
  );

  const completion = await openai.chat.completions.create({
    model: TEXT_MODEL,
    temperature: 0.15,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: TIMELINE_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
  });

  const raw = completion.choices[0]?.message?.content?.trim();
  if (!raw) {
    throw new Error('timeline model empty output');
  }

  const parsed = parseJsonObject<TimelineJson>(raw);
  const allowed = new Set([
    'color_shift',
    'leaf_drop',
    'growth_change',
    'density_change',
    'suspected_stress',
    'general',
  ]);
  const signalType = typeof parsed.signal_type === 'string' && allowed.has(parsed.signal_type)
    ? parsed.signal_type
    : 'general';
  const strength =
    typeof parsed.signal_strength === 'number' && Number.isFinite(parsed.signal_strength)
      ? Math.min(1, Math.max(0, parsed.signal_strength))
      : 0.25;
  const description =
    typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 2000) : null;
  const correlated =
    parsed.correlated_factors &&
    typeof parsed.correlated_factors === 'object' &&
    !Array.isArray(parsed.correlated_factors)
      ? (parsed.correlated_factors as Record<string, unknown>)
      : {};

  if (!description || strength <= 0.35) {
    return {
      skipped: true,
      reason: 'low_confidence_or_empty',
      draft: { signal_type: signalType, signal_strength: strength },
    };
  }

  const { error: upSig } = await supabase.from('photo_timeline_signals').upsert(
    {
      farm_id: farmId,
      cycle_id: anchor.cycle_id,
      zone_id: anchor.zone_id,
      scope_id: anchor.scope_id,
      plant_id: anchor.plant_id,
      from_media_asset_id: prev.id,
      to_media_asset_id: anchor.id,
      signal_type: signalType,
      signal_strength: strength,
      description,
      correlated_factors: correlated,
      analysis_version: analysisVersion,
    },
    { onConflict: 'farm_id,from_media_asset_id,to_media_asset_id' }
  );
  if (upSig) throw upSig;

  return {
    from_media_asset_id: prev.id,
    to_media_asset_id: anchor.id,
    signal_type: signalType,
    signal_strength: strength,
  };
}
