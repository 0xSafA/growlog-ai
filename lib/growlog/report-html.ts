/** Render printable HTML for report artifacts (HTML + PDF-via-print). */
import type { ReportBlock, ReportJsonV1 } from '@/types/report';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function blockToHtml(block: ReportBlock): string {
  switch (block.kind) {
    case 'executive_summary':
    case 'narrative':
    case 'appendix':
      return `<section><h2>${escapeHtml(block.title)}</h2><p>${escapeHtml(block.body).replace(/\n/g, '<br/>')}</p></section>`;
    case 'timeline_highlights':
      return `<section><h2>${escapeHtml(block.title)}</h2><ul>${block.items
        .map((i) => `<li><strong>${escapeHtml(i.at)}</strong>: ${escapeHtml(i.summary)}</li>`)
        .join('')}</ul></section>`;
    case 'anomalies':
      return `<section><h2>${escapeHtml(block.title)}</h2><ul>${block.items
        .map((i) => `<li>${escapeHtml(i.summary)}</li>`)
        .join('')}</ul></section>`;
    case 'missing_data':
      return `<section><h2>${escapeHtml(block.title)}</h2><ul>${block.notes
        .map((n) => `<li>${escapeHtml(n)}</li>`)
        .join('')}</ul></section>`;
    default:
      return '';
  }
}

export function renderReportHtml(params: {
  title: string;
  reportJson: ReportJsonV1;
}): string {
  const blocks = params.reportJson.blocks.map(blockToHtml).join('\n');
  return `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="utf-8"/>
  <title>${escapeHtml(params.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 720px; margin: 2rem auto; line-height: 1.5; color: #111; }
    h1 { font-size: 1.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.5rem; }
    section { margin-bottom: 1rem; }
    @media print { body { margin: 1cm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(params.title)}</h1>
  <p><small>Growlog Report · ${escapeHtml(params.reportJson.pipeline_version)}</small></p>
  ${blocks}
</body>
</html>`;
}
