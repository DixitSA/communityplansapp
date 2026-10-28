import type { AuthSession, MyProfile } from '@/lib/api';

import { gateAllows, resolveGate } from '../gate';

const session: AuthSession = { userId: 'u1', email: 'a@b.co' };
const profile: MyProfile = { id: 'u1', username: 'maya', displayName: 'Maya', homeCityId: 1, interests: [] };

describe('resolveGate', () => {
  it('is demo mode whenever the backend is not configured, whatever the session', () => {
    expect(resolveGate({ configured: false, session: null, profile: null })).toBe('demo');
    expect(resolveGate({ configured: false, session: undefined, profile: undefined })).toBe('demo');
    expect(resolveGate({ configured: false, session, profile })).toBe('demo');
  });

  it('waits while the saved session is being read', () => {
    expect(resolveGate({ configured: true, session: undefined, profile: undefined })).toBe('loading');
  });

  it('sends signed-out people to auth', () => {
    expect(resolveGate({ configured: true, session: null, profile: undefined })).toBe('auth');
    expect(resolveGate({ configured: true, session: null, profile: null })).toBe('auth');
  });

  it('waits for the profile after sign-in', () => {
    expect(resolveGate({ configured: true, session, profile: undefined })).toBe('loading');
  });

  it('sends signed-in people without a profile to onboarding', () => {
    expect(resolveGate({ configured: true, session, profile: null })).toBe('onboarding');
  });

  it('opens the app once there is a profile', () => {
    expect(resolveGate({ configured: true, session, profile })).toBe('app');
  });
});

describe('gateAllows', () => {
  it('opens every group in demo mode', () => {
    expect(gateAllows('demo', 'auth')).toBe(true);
    expect(gateAllows('demo', 'onboarding')).toBe(true);
    expect(gateAllows('demo', 'app')).toBe(true);
  });

  it('opens exactly one group otherwise', () => {
    expect(gateAllows('auth', 'auth')).toBe(true);
    expect(gateAllows('auth', 'app')).toBe(false);
    expect(gateAllows('onboarding', 'onboarding')).toBe(true);
    expect(gateAllows('onboarding', 'app')).toBe(false);
    expect(gateAllows('app', 'app')).toBe(true);
    expect(gateAllows('app', 'onboarding')).toBe(false);
    expect(gateAllows('app', 'auth')).toBe(false);
  });

  it('opens nothing while loading', () => {
    expect(gateAllows('loading', 'auth')).toBe(false);
    expect(gateAllows('loading', 'onboarding')).toBe(false);
    expect(gateAllows('loading', 'app')).toBe(false);
  });
});
