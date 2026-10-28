import { isBackendConfigured } from '../env';
import { requireSupabase } from '../supabase';
import { createDemoApi } from './demo';
import { createRemoteApi } from './remote';
import type { Api } from './types';

export * from './types';
export * from './errors';
export { DEMO_INTERESTS, DEMO_PROFILE, createDemoApi } from './demo';

/**
 * The app's only door to the backend. Screens call feature hooks, hooks call this.
 * Demo mode (no Supabase keys) swaps in in-memory fakes with the same signatures.
 */
export const api: Api = isBackendConfigured ? createRemoteApi(requireSupabase()) : createDemoApi();
