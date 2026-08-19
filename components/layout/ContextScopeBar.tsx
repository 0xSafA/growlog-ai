'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { MapPin } from 'lucide-react';

/** ADR-005: scope-aware UX — user always sees farm / cycle / scope. */
export function ContextScopeBar() {
  const { farms, farmId, cycle, scopes, scopeId, setScopeId, primaryScope, loading } =
    useFarmContext();
  const { t } = useTranslation();

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
        {t('scope.loading')}
      </p>
    );
  }

  const farm = farms.find((f) => f.id === farmId);
  if (!farmId || !farm) {
    return null;
  }

  const parts: string[] = [farm.name];
  if (cycle) {
    parts.push(cycle.name);
  }

  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
      <p
        className="text-xs text-muted-foreground flex items-start gap-1.5 leading-snug"
        title={t('scope.contextTitle')}
      >
        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-70" />
        <span className="min-w-0">{parts.join(' · ')}</span>
      </p>
      {scopes.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground shrink-0">{t('common.scope')}:</span>
          {scopes.length === 1 ? (
            <span className="text-xs">
              {primaryScope?.display_name ?? primaryScope?.scope_type.replace(/_/g, ' ')}
            </span>
          ) : (
            <select
              className="h-8 rounded-md border border-input bg-background px-2 text-xs max-w-[200px]"
              value={scopeId ?? ''}
              onChange={(e) => setScopeId(e.target.value)}
            >
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name || s.scope_type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}
