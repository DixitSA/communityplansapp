import { renderRouter, screen } from 'expo-router/testing-library';

import type { AuthSession, MyProfile } from '@/lib/api';

// This file pretends Supabase is configured, so the root layout's guards are live.
jest.mock('@/lib/env', () => ({ isBackendConfigured: true, supabaseUrl: '', supabaseAnonKey: '' }));
jest.mock('@/design/components/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/features/onboarding/WelcomeBlob', () => ({ WelcomeBlob: () => null }));

const mockState: { session: AuthSession | null; profile: MyProfile | null } = { session: null, profile: null };
jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api/errors'),
  CHARLOTTE_CITY_ID: 1,
  api: {
    getSession: async () => mockState.session,
    onSessionChange: () => () => {},
    getMyProfile: async () => mockState.profile,
    listInterests: async () => [],
    usernameAvailable: async () => true,
  },
}));

const session: AuthSession = { userId: 'u1', email: 'maya@example.com' };
const profile: MyProfile = { id: 'u1', username: 'maya', displayName: 'Maya', homeCityId: 1, interests: [] };

describe('root guards with a backend', () => {
  it('shows the welcome screen to signed-out people, even when they ask for the feed', async () => {
    mockState.session = null;
    mockState.profile = null;
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Continue with email')).toBeTruthy();
    expect(screen.queryByText('Nearby')).toBeNull();
  });

  it('keeps signed-in people without a profile in onboarding', async () => {
    mockState.session = session;
    mockState.profile = null;
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('The basics')).toBeTruthy();
    expect(screen.queryByText('Nearby')).toBeNull();
  });

  it('opens the feed once there is a profile', async () => {
    mockState.session = session;
    mockState.profile = profile;
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Nearby')).toBeTruthy();
    expect(screen.queryByText('The basics')).toBeNull();
  });
});
