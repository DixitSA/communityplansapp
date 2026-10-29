import type { SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from './database.types';
import { isBackendConfigured } from './env';
import { createSupabaseClient } from './supabaseClient';

function create(): SupabaseClient<Database> | null {
  if (!isBackendConfigured) return null;
  // Installs a localStorage polyfill backed by SQLite, which keeps the sign-in session on the phone.
  // Loaded only when configured, so demo mode never touches SQLite.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a side-effect import that must be conditional
  require('expo-sqlite/localStorage/install');
  const client = createSupabaseClient(localStorage);
  // React Native has no timers while the app sleeps, so refresh the access token only in the foreground.
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
  return client;
}

/** The one Supabase client. `null` in demo mode. Only `src/lib/api` may import this. */
export const supabase = create();

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
