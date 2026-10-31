import { isBackendConfigured } from '../env';
import { requireSupabase } from '../supabase';
import { createDemoApi } from './demo';
import { createRemoteApi } from './remote';
import type { Api } from './types';

export * from './types';
export * from './errors';
export * from './friendTypes';
export { normalizeSearchQuery } from './friendsMapping';
export { chatIsOpen, normalizeMessageBody } from './chatMapping';
export { DEMO_INTERESTS, DEMO_PROFILE, createDemoApi, demoEvent, demoFeed, demoFeedRange, demoSpotlight } from './demo';
export { METERS_PER_MILE } from './feedMapping';

/**
 * The app's only door to the backend. Screens call feature hooks, hooks call this.
 * Demo mode (no Supabase keys) swaps in in-memory fakes with the same signatures.
 */
export const api: Api = isBackendConfigured ? createRemoteApi(requireSupabase()) : createDemoApi();
