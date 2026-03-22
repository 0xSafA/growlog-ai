'use client';

import { useFarmContext } from '@/components/providers/FarmProvider';
import { MapPin } from 'lucide-react';

/** ADR-005: scope-aware UX — user always sees farm / cycle / scope. */
export function ContextScopeBar() {
  const { farms, farmId, cycle, primaryScope, loading } = useFarmContext();

  if (loading) {
    return (
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" />
        Загрузка контекста…
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
  if (primaryScope) {
    parts.push(
      `${primaryScope.scope_type.replace(/_/g, ' ')}${primaryScope.display_name ? `: ${primaryScope.display_name}` : ''}`
    );
  }

  return (
    <p
      className="text-xs text-muted-foreground flex items-start gap-1.5 leading-snug"
      title="Текущий контекст: ферма, цикл, область"
    >
      <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5 opacity-70" />
      <span className="min-w-0">{parts.join(' · ')}</span>
    </p>
  );
}
