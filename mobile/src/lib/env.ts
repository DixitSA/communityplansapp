// Expo only inlines EXPO_PUBLIC_* variables when they are written out in full like this.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when both values are non-empty. Pure so it can be tested. */
export function hasBackendConfig(supabaseUrl: string | undefined, key: string | undefined): boolean {
  return Boolean(supabaseUrl?.trim() && key?.trim());
}

export const supabaseUrl = url ?? '';
export const supabaseAnonKey = anonKey ?? '';

/** Just the host of the Supabase URL, for diagnostics. Never log the key. */
export function backendHost(): string {
  try {
    return new URL(url ?? '').host;
  } catch {
    return '(invalid url)';
  }
}

/**
 * Both Supabase values are set. When false the app runs in demo mode: sample data, no sign-in,
 * every onboarding screen reachable (see docs/SUPABASE_SETUP.md to switch it on).
 */
export const isBackendConfigured = hasBackendConfig(url, anonKey);
