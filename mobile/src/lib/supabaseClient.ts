import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { Database } from './database.types';
import { supabaseAnonKey, supabaseUrl } from './env';

/** Shared setup for the native and web clients. `storage` is where the session is kept. */
export function createSupabaseClient(storage: Storage | undefined): SupabaseClient<Database> {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
