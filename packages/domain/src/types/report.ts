/**
 * ADR-007: report axes and structured blocks (report_json.blocks).
 */

export const REPORT_TYPES = [
  'daily',
  'cycle',
  'manager',
  'public_html',
  'pdf',
  'other',
] as const;
export type ReportType = (typeof REPORT_TYPES)[number];

export const AUDIENCE_TYPES = [
  'internal_operational',
  'internal_management',
  'public_community',
  'archive_personal',
] as const;
export type AudienceType = (typeof AUDIENCE_TYPES)[number];

export const OUTPUT_FORMATS = ['html', 'pdf', 'both', 'preview_only'] as const;
export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export type ReportTrustLabel = 'observed_fact' | 'derived_metric' | 'ai_generated' | 'missing_data';

export type ReportBlock =
  | {
      kind: 'header';
      title: string;
      periodLabel: string;
      scopeLabel: string;
      cycleName: string | null;
      cycleStage: string | null;
    }
  | {
      kind: 'executive_summary';
      title: string;
      body: string;
      trust: ReportTrustLabel;
    }
  | {
      kind: 'metric_strip';
      title: string;
      items: { label: string; value: string; source: ReportTrustLabel }[];
    }
  | {
      kind: 'timeline_highlights';
      title: string;
      items: { at: string; eventType: string; summary: string }[];
    }
  | {
      kind: 'anomalies';
      title: string;
      items: { at: string; summary: string; severity: string | null }[];
    }
  | {
      kind: 'sop_compliance';
      title: string;
      items: { title: string; status: string; dueAt: string | null }[];
    }
  | {
      kind: 'photos';
      title: string;
      items: { mediaAssetId: string; caption: string | null; layoutRole: string }[];
    }
  | {
      kind: 'narrative';
      title: string;
      body: string;
      trust: ReportTrustLabel;
    }
  | {
      kind: 'missing_data';
      title: string;
      notes: string[];
    }
  | {
      kind: 'appendix';
      title: string;
      body: string;
      trust: ReportTrustLabel;
    };

export type ReportJsonV1 = {
  pipeline_version: 'adr007-v1';
  request: {
    report_type: ReportType;
    audience_type: AudienceType;
    output_format: OutputFormat;
    time_window: { from: string; to: string };
    scope_label: string;
  };
  blocks: ReportBlock[];
  trust_notes: string[];
  pdf_status?: 'not_generated' | 'failed' | 'ready';
};

export type ReportRow = {
  id: string;
  farm_id: string;
  cycle_id: string | null;
  zone_id: string | null;
  scope_id: string | null;
  report_type: ReportType;
  /** Present after ADR-007 migration */
  audience_type?: AudienceType;
  output_format?: OutputFormat;
  title: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  summary_text: string | null;
  narrative_text: string | null;
  report_json: ReportJsonV1 | Record<string, unknown>;
  created_by: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};
