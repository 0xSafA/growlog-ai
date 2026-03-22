'use client';

import type { ReportBlock } from '@/types/report';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useEffect, useState } from 'react';

async function signedImageUrl(
  supabase: SupabaseClient,
  mediaAssetId: string
): Promise<string | null> {
  const { data: asset, error } = await supabase
    .from('media_assets')
    .select('storage_bucket, storage_path')
    .eq('id', mediaAssetId)
    .maybeSingle();
  if (error || !asset?.storage_bucket || !asset?.storage_path) return null;
  const { data, error: sErr } = await supabase.storage
    .from(asset.storage_bucket)
    .createSignedUrl(asset.storage_path, 3600);
  if (sErr || !data?.signedUrl) return null;
  return data.signedUrl;
}

function TrustBadge({ trust }: { trust: string }) {
  const label =
    trust === 'ai_generated'
      ? 'AI narrative'
      : trust === 'derived_metric'
        ? 'Сводка из данных'
        : trust === 'missing_data'
          ? 'Нет данных'
          : 'Факт';
  return (
    <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
      {label}
    </span>
  );
}

export function ReportViewer({
  blocks,
  supabase,
}: {
  blocks: ReportBlock[];
  supabase: SupabaseClient;
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});

  useEffect(() => {
    const ids = new Set<string>();
    for (const b of blocks) {
      if (b.kind === 'photos') {
        b.items.forEach((i) => ids.add(i.mediaAssetId));
      }
    }
    if (!ids.size) return;
    let cancelled = false;
    (async () => {
      const next: Record<string, string | null> = {};
      for (const id of ids) {
        next[id] = await signedImageUrl(supabase, id);
      }
      if (!cancelled) setUrls(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [blocks, supabase]);

  return (
    <div className="space-y-8">
      {blocks.map((b, i) => {
        const key = `${b.kind}-${i}`;
        switch (b.kind) {
          case 'header':
            return (
              <header key={key} className="space-y-1 border-b border-border pb-4">
                <h2 className="text-xl font-semibold leading-tight">{b.title}</h2>
                <p className="text-sm text-muted-foreground">{b.periodLabel}</p>
                <p className="text-sm">Scope: {b.scopeLabel}</p>
                {(b.cycleName || b.cycleStage) && (
                  <p className="text-sm text-muted-foreground">
                    {b.cycleName}
                    {b.cycleStage ? ` · ${b.cycleStage}` : ''}
                  </p>
                )}
              </header>
            );
          case 'executive_summary':
          case 'narrative':
          case 'appendix':
            return (
              <section key={key} className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-medium">{b.title}</h3>
                  <TrustBadge trust={b.trust} />
                </div>
                <div className="text-sm whitespace-pre-wrap leading-relaxed">{b.body}</div>
              </section>
            );
          case 'metric_strip':
            return (
              <section key={key} className="space-y-2">
                <h3 className="text-base font-medium">{b.title}</h3>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {b.items.map((m, j) => (
                    <div
                      key={`${m.label}-${j}`}
                      className="rounded-lg border border-border/80 bg-card/40 px-3 py-2"
                    >
                      <p className="text-[11px] text-muted-foreground">{m.label}</p>
                      <p className="text-sm font-medium">{m.value}</p>
                    </div>
                  ))}
                </div>
              </section>
            );
          case 'timeline_highlights':
            return (
              <section key={key} className="space-y-2">
                <h3 className="text-base font-medium">{b.title}</h3>
                <ul className="space-y-2 text-sm">
                  {b.items.map((e, j) => (
                    <li key={j} className="border-l-2 border-primary/30 pl-3">
                      <p className="text-[11px] text-muted-foreground">
                        {e.at.slice(0, 16)} · {e.eventType}
                      </p>
                      <p>{e.summary}</p>
                    </li>
                  ))}
                </ul>
              </section>
            );
          case 'anomalies':
            return (
              <section key={key} className="space-y-2">
                <h3 className="text-base font-medium">{b.title}</h3>
                {b.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет записей в выборке.</p>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {b.items.map((e, j) => (
                      <li key={j} className="rounded-md bg-amber-500/10 px-3 py-2">
                        <p className="text-[11px] text-muted-foreground">
                          {e.at.slice(0, 16)}
                          {e.severity ? ` · ${e.severity}` : ''}
                        </p>
                        <p>{e.summary}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          case 'sop_compliance':
            return (
              <section key={key} className="space-y-2">
                <h3 className="text-base font-medium">{b.title}</h3>
                <ul className="space-y-2 text-sm">
                  {b.items.map((s, j) => (
                    <li
                      key={j}
                      className="flex flex-wrap items-baseline justify-between gap-2 rounded-md border border-border/60 px-3 py-2"
                    >
                      <span>{s.title}</span>
                      <span className="text-xs text-muted-foreground">
                        {s.status}
                        {s.dueAt ? ` · до ${s.dueAt.slice(0, 16)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            );
          case 'photos':
            return (
              <section key={key} className="space-y-2">
                <h3 className="text-base font-medium">{b.title}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {b.items.map((p) => {
                    const src = urls[p.mediaAssetId];
                    return (
                      <figure
                        key={p.mediaAssetId}
                        className="overflow-hidden rounded-lg border border-border/80 bg-card/30"
                      >
                        {src ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={src} alt="" className="h-44 w-full object-cover" />
                        ) : (
                          <div className="flex h-44 items-center justify-center text-xs text-muted-foreground">
                            Загрузка…
                          </div>
                        )}
                        <figcaption className="px-2 py-1.5 text-xs text-muted-foreground">
                          {p.layoutRole} · {p.caption}
                        </figcaption>
                      </figure>
                    );
                  })}
                </div>
              </section>
            );
          case 'missing_data':
            return (
              <section key={key} className="space-y-2 rounded-lg border border-dashed border-border px-3 py-3">
                <h3 className="text-base font-medium">{b.title}</h3>
                <ul className="list-disc pl-4 text-sm text-muted-foreground">
                  {b.notes.map((n, j) => (
                    <li key={j}>{n}</li>
                  ))}
                </ul>
              </section>
            );
          default:
            return null;
        }
      })}
    </div>
  );
}
