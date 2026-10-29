import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { createFetchWithTimeout } from './fetchWithTimeout';
import { supabaseAnonKey, supabaseUrl } from './env';

/** Shared setup for the native and web clients. `storage` is where the session is kept. */
export function createSupabaseClient(storage: Storage | undefined): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    // A request that never answers fails after 10 s, so screens reach their error state instead of hanging.
    global: { fetch: createFetchWithTimeout() },
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
