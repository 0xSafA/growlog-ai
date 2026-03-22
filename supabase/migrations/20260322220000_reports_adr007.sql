-- ADR-007: independent axes for report engine (audience vs output format)
-- Idempotent: safe if columns already exist (partial apply / repeat push).

do $migration$
begin
  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reports'
      and column_name = 'audience_type'
  ) then
    alter table public.reports
      add column audience_type text not null default 'internal_operational'
        check (audience_type in (
          'internal_operational',
          'internal_management',
          'public_community',
          'archive_personal'
        ));
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'reports'
      and column_name = 'output_format'
  ) then
    alter table public.reports
      add column output_format text not null default 'html'
        check (output_format in ('html', 'pdf', 'both', 'preview_only'));
  end if;
end $migration$;

comment on column public.reports.audience_type is 'ADR-007: who the report is for (separate from report_type and format).';
comment on column public.reports.output_format is 'ADR-007: html | pdf | both | preview_only.';
