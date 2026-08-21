/** Farm-local calendar date (yyyy-MM-dd) for SOP materialize anchor. */
export function anchorDateForTimezone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

export function sopRunTitle(run: {
  sop_definitions?: unknown;
}): string {
  if (
    run.sop_definitions &&
    typeof run.sop_definitions === 'object' &&
    'title' in run.sop_definitions
  ) {
    return (run.sop_definitions as { title: string }).title;
  }
  return 'SOP';
}
