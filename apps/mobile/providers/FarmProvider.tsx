import {
  createMobileSupabase,
  getStoredFarmId,
  getStoredScopeId,
  setStoredFarmId,
  setStoredScopeId,
} from '@growlog/api-client';
import {
  endOfTodayIso,
  fetchActiveCycle,
  fetchFarms,
  fetchRecentEvents,
  fetchScopesForCycle,
  startOfTodayIso,
} from '@growlog/domain';
import type { EventRow, Farm, GrowCycle, Scope } from '@growlog/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useQuery } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

type FarmContextValue = {
  supabase: SupabaseClient;
  userId: string | null;
  authLoading: boolean;
  farmListReady: boolean;
  farms: Farm[];
  farmId: string | null;
  setFarmId: (id: string) => void;
  cycle: GrowCycle | null;
  scopes: Scope[];
  scopeId: string | null;
  setScopeId: (id: string) => void;
  primaryScope: Scope | null;
  todayEvents: EventRow[];
  recentEvents: EventRow[];
  loading: boolean;
  refetchAll: () => void;
};

const FarmContext = createContext<FarmContextValue | null>(null);

export function FarmProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createMobileSupabase(), []);
  const [userId, setUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [farmId, setFarmIdState] = useState<string | null>(null);
  const [scopeId, setScopeIdState] = useState<string | null>(null);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
      setAuthLoading(false);
    });
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserId(user?.id ?? null);
      setAuthLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  const farmsQuery = useQuery({
    queryKey: ['farms', userId],
    enabled: !!userId,
    queryFn: () => fetchFarms(supabase),
  });

  useEffect(() => {
    if (!farmsQuery.data?.length) return;
    void (async () => {
      const stored = await getStoredFarmId();
      const valid = stored && farmsQuery.data!.some((f) => f.id === stored);
      if (valid && stored) {
        setFarmIdState(stored);
        return;
      }
      setFarmIdState(farmsQuery.data![0].id);
    })();
  }, [farmsQuery.data]);

  const setFarmId = useCallback((id: string) => {
    void setStoredFarmId(id);
    setFarmIdState(id);
  }, []);

  const cycleQuery = useQuery({
    queryKey: ['active-cycle', farmId],
    enabled: !!farmId,
    queryFn: () => fetchActiveCycle(supabase, farmId!),
  });

  const scopesQuery = useQuery({
    queryKey: ['scopes', cycleQuery.data?.id],
    enabled: !!cycleQuery.data?.id,
    queryFn: () => fetchScopesForCycle(supabase, cycleQuery.data!.id),
  });

  useEffect(() => {
    if (!scopesQuery.data?.length) {
      setScopeIdState(null);
      return;
    }
    void (async () => {
      const stored = await getStoredScopeId();
      const valid = stored && scopesQuery.data!.some((s) => s.id === stored);
      if (valid && stored) {
        setScopeIdState(stored);
        return;
      }
      setScopeIdState(scopesQuery.data![0].id);
    })();
  }, [scopesQuery.data]);

  const setScopeId = useCallback((id: string) => {
    void setStoredScopeId(id);
    setScopeIdState(id);
  }, []);

  const primaryScope =
    scopesQuery.data?.find((s) => s.id === scopeId) ?? scopesQuery.data?.[0] ?? null;

  const recentQuery = useQuery({
    queryKey: ['events-recent', farmId, cycleQuery.data?.id],
    enabled: !!farmId && !!cycleQuery.data?.id,
    queryFn: () =>
      fetchRecentEvents(supabase, {
        farmId: farmId!,
        cycleId: cycleQuery.data!.id,
        limit: 80,
      }),
  });

  const todayQuery = useQuery({
    queryKey: ['events-today', farmId, cycleQuery.data?.id],
    enabled: !!farmId && !!cycleQuery.data?.id,
    queryFn: async () => {
      const start = startOfTodayIso();
      const end = endOfTodayIso();
      const { data, error } = await supabase
        .from('events')
        .select(
          'id, farm_id, cycle_id, scope_id, event_type, title, body, occurred_at, source_type, payload, created_at'
        )
        .eq('farm_id', farmId!)
        .eq('cycle_id', cycleQuery.data!.id)
        .gte('occurred_at', start)
        .lte('occurred_at', end)
        .order('occurred_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventRow[];
    },
  });

  const refetchAll = useCallback(() => {
    farmsQuery.refetch();
    cycleQuery.refetch();
    scopesQuery.refetch();
    recentQuery.refetch();
    todayQuery.refetch();
  }, [farmsQuery, cycleQuery, scopesQuery, recentQuery, todayQuery]);

  const value: FarmContextValue = {
    supabase,
    userId,
    authLoading,
    farmListReady: !userId || farmsQuery.isFetched,
    farms: farmsQuery.data ?? [],
    farmId,
    setFarmId,
    cycle: cycleQuery.data ?? null,
    scopes: scopesQuery.data ?? [],
    scopeId,
    setScopeId,
    primaryScope,
    todayEvents: todayQuery.data ?? [],
    recentEvents: recentQuery.data ?? [],
    loading:
      authLoading ||
      farmsQuery.isLoading ||
      (!!farmId && cycleQuery.isLoading) ||
      (!!cycleQuery.data && scopesQuery.isLoading),
    refetchAll,
  };

  return <FarmContext.Provider value={value}>{children}</FarmContext.Provider>;
}

export function useFarmContext() {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarmContext must be used within FarmProvider');
  return ctx;
}
