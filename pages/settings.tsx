'use client';

import { AppRouteReady } from '@/components/AppRouteReady';
import { AppShell } from '@/components/layout/AppShell';
import { PageHead } from '@/components/layout/PageHead';
import { useFarmContext } from '@/components/providers/FarmProvider';
import { useTranslation } from '@/components/providers/I18nProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useEffect, useState } from 'react';

function SettingsBody() {
  const { t } = useTranslation();
  const { supabase, farms, farmId, setFarmId, cycle, scopes, scopeId, setScopeId, refetchAll } =
    useFarmContext();
  const farm = farms.find((f) => f.id === farmId);
  const [name, setName] = useState(farm?.name ?? '');
  const [pending, setPending] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (farm) setName(farm.name);
  }, [farm]);

  async function saveFarmName(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId) return;
    setPending(true);
    setMsg(null);
    try {
      const { error } = await supabase.from('farms').update({ name: name.trim() }).eq('id', farmId);
      if (error) throw error;
      await refetchAll();
      setMsg(t('common.saved'));
    } catch (err: unknown) {
      setMsg(err instanceof Error ? err.message : t('common.error'));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.farm')}</CardTitle>
          <CardDescription>{t('settings.farmDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveFarmName} className="space-y-3">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
            <Button type="submit" size="sm" disabled={pending}>
              {pending ? t('auth.signInPending') : t('settings.saveName')}
            </Button>
            {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
          </form>
        </CardContent>
      </Card>

      {farms.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.activeFarm')}</CardTitle>
          </CardHeader>
          <CardContent>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={farmId ?? ''}
              onChange={(e) => setFarmId(e.target.value)}
            >
              {farms.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      {cycle && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.activeCycle')}</CardTitle>
            <CardDescription>
              {cycle.name} · {cycle.stage} · {t('common.since')} {cycle.start_date}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      <ScopesAndPlantsSettings />
    </div>
  );
}

function ScopesAndPlantsSettings() {
  const { t } = useTranslation();
  const { supabase, farmId, cycle, scopes, scopeId, setScopeId } = useFarmContext();
  const [plants, setPlants] = useState<{ id: string; plant_code: string; status: string }[]>([]);
  const [plantLabel, setPlantLabel] = useState('');
  const [loadingPlants, setLoadingPlants] = useState(false);

  useEffect(() => {
    if (!farmId || !cycle?.id) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('plants')
        .select('id, plant_code, status')
        .eq('farm_id', farmId)
        .eq('cycle_id', cycle.id)
        .order('created_at', { ascending: true });
      if (!cancelled) setPlants((data ?? []) as { id: string; plant_code: string; status: string }[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase, farmId, cycle?.id]);

  async function addPlant(e: React.FormEvent) {
    e.preventDefault();
    if (!farmId || !cycle?.id) return;
    setLoadingPlants(true);
    try {
      const code = plantLabel.trim() || `plant-${Date.now()}`;
      const { error } = await supabase.from('plants').insert({
        farm_id: farmId,
        cycle_id: cycle.id,
        plant_code: code,
        status: 'active',
      });
      if (error) throw error;
      setPlantLabel('');
      const { data } = await supabase
        .from('plants')
        .select('id, plant_code, status')
        .eq('farm_id', farmId)
        .eq('cycle_id', cycle.id);
      setPlants((data ?? []) as { id: string; plant_code: string; status: string }[]);
    } finally {
      setLoadingPlants(false);
    }
  }

  if (!cycle) return null;

  return (
    <>
      {scopes.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t('settings.scopeTitle')}</CardTitle>
            <CardDescription>{t('settings.scopeDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={scopeId ?? ''}
              onChange={(e) => setScopeId(e.target.value)}
            >
              {scopes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.display_name || s.scope_type}
                </option>
              ))}
            </select>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t('settings.plantsTitle')}</CardTitle>
          <CardDescription>{t('settings.plantsDesc')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {plants.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('settings.noPlants')}</p>
          ) : (
            <ul className="text-sm space-y-1">
              {plants.map((p) => (
                <li key={p.id}>
                  {p.plant_code} · <span className="text-muted-foreground">{p.status}</span>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={addPlant} className="flex gap-2">
            <Input
              placeholder={t('settings.plantPlaceholder')}
              value={plantLabel}
              onChange={(e) => setPlantLabel(e.target.value)}
            />
            <Button type="submit" size="sm" disabled={loadingPlants}>
              {t('common.add')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </>
  );
}

function SettingsPageBody() {
  const { t } = useTranslation();
  return (
    <>
      <PageHead titleKey="titles.settings" />
      <AppShell title={t('titles.settings')}>
        <SettingsBody />
      </AppShell>
    </>
  );
}

export default function SettingsPage() {
  return (
    <AppRouteReady>
      <SettingsPageBody />
    </AppRouteReady>
  );
}
