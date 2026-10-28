import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { isBackendConfigured } from './env';
import { createSupabaseClient } from './supabaseClient';

// Web build (screenshots, previews). The browser has a real localStorage, so no SQLite is needed
// (expo-sqlite's web worker needs a wasm file that Metro can't bundle here). It is missing while a
// page renders on the server; the client then simply doesn't persist there.
const storage = typeof localStorage === 'undefined' ? undefined : localStorage;

/** The one Supabase client. `null` in demo mode. Only `src/lib/api` may import this. */
export const supabase: SupabaseClient<Database> | null = isBackendConfigured ? createSupabaseClient(storage) : null;

export function requireSupabase(): SupabaseClient<Database> {
  if (!supabase) throw new Error('Supabase is not configured');
  return supabase;
}
