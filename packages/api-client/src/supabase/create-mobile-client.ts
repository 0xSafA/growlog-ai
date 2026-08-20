import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const FALLBACK_URL = 'https://placeholder.local';
const FALLBACK_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder';

const secureStoreAdapter = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

export function createMobileSupabase(): SupabaseClient {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? FALLBACK_URL;
  const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? FALLBACK_KEY;

  return createClient(url, anonKey, {
    auth: {
      storage: secureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

export const FARM_STORAGE_KEY = 'growlog_active_farm_id';
export const SCOPE_STORAGE_KEY = 'growlog_active_scope_id';

export async function getStoredFarmId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(FARM_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredFarmId(id: string): Promise<void> {
  await SecureStore.setItemAsync(FARM_STORAGE_KEY, id);
}

export async function getStoredScopeId(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(SCOPE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export async function setStoredScopeId(id: string): Promise<void> {
  await SecureStore.setItemAsync(SCOPE_STORAGE_KEY, id);
}
