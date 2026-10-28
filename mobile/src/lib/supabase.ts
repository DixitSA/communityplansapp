import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { isBackendConfigured } from './env';
import { createSupabaseClient } from './supabaseClient';

function create(): SupabaseClient<Database> | null {
  if (!isBackendConfigured) return null;
  // Installs a localStorage polyfill backed by SQLite, which keeps the sign-in session on the phone.
  // Loaded only when configured, so demo mode never touches SQLite.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- a side-effect import that must be conditional
  require('expo-sqlite/localStorage/install');
  return createSupabaseClient(localStorage);
}

/** The one Supabase client. `null` in demo mode. Only `src/lib/api` may import this. */
export const supabase = create();

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
