import { ApiError } from '../errors';
import { DEMO_BAD_CODE, DEMO_INTERESTS, DEMO_PROFILE, createDemoApi } from '../demo';
import { CHARLOTTE_CITY_ID, type OnboardingInput } from '../types';

const good: OnboardingInput = {
  username: 'Maya.C',
  displayName: '  Maya Chen ',
  birthdate: '1995-06-15',
  interestIds: [1, 2, 3],
  homeCityId: CHARLOTTE_CITY_ID,
};

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.code : 'not-an-api-error';
  }
};

describe('demo API fakes', () => {
  const make = () => createDemoApi({ delayMs: 0 });

  it('lists the seeded interests', async () => {
    const list = await make().listInterests();
    expect(list).toHaveLength(12);
    expect(list).toBe(DEMO_INTERESTS);
    expect(list.every((i) => i.symbol.length > 0 && i.label.length > 0)).toBe(true);
  });

  it('checks usernames like the server: format first, then taken', async () => {
    const api = make();
    expect(await api.usernameAvailable('fresh.name')).toBe(true);
    expect(await api.usernameAvailable('Fresh.Name')).toBe(true);
    expect(await api.usernameAvailable('ab')).toBe(false);
    expect(await api.usernameAvailable('.nope')).toBe(false);
    expect(await api.usernameAvailable('admin')).toBe(false);
  });

  it('signs in with any 6-digit code except the bad one, and tells listeners', async () => {
    const api = make();
    const seen: (string | null)[] = [];
    const off = api.onSessionChange((s) => seen.push(s ? s.userId : null));

    expect(await codeOf(api.verifyEmailCode('a@b.co', DEMO_BAD_CODE))).toBe('otp_invalid');
    expect(await codeOf(api.verifyEmailCode('a@b.co', '123'))).toBe('otp_invalid');
    expect(await api.getSession()).toBeNull();

    await api.verifyEmailCode('A@B.co', '123456');
    expect((await api.getSession())?.email).toBe('a@b.co');

    await api.signOut();
    expect(await api.getSession()).toBeNull();
    expect(seen).toEqual(['demo-user', null]);

    off();
    await api.verifyEmailCode('a@b.co', '654321');
    expect(seen).toHaveLength(2);
  });

  it('rejects a malformed email when sending a code', async () => {
    expect(await codeOf(make().sendEmailCode('nope'))).toBe('validation_failed');
    expect(await codeOf(make().sendEmailCode('maya@example.com'))).toBeNull();
  });

  it('returns the Apple given name for prefill', async () => {
    expect(await make().signInWithApple()).toEqual({ givenName: 'Taylor' });
  });

  it('shows a sample profile until onboarding completes, then the new one', async () => {
    const api = make();
    expect(await api.getMyProfile()).toBe(DEMO_PROFILE);

    await api.completeOnboarding(good);
    const me = await api.getMyProfile();
    expect(me?.username).toBe('maya.c');
    expect(me?.displayName).toBe('Maya Chen');
    expect(me?.interests.map((i) => i.id)).toEqual([1, 2, 3]);
  });

  it('raises the same error codes as complete_onboarding', async () => {
    const api = make();
    expect(await codeOf(api.completeOnboarding({ ...good, username: 'a' }))).toBe('username_invalid');
    expect(await codeOf(api.completeOnboarding({ ...good, username: 'yard' }))).toBe('username_taken');
    expect(await codeOf(api.completeOnboarding({ ...good, displayName: '   ' }))).toBe('display_name_invalid');
    expect(await codeOf(api.completeOnboarding({ ...good, birthdate: '2015-01-01' }))).toBe('must_be_18');
    expect(await codeOf(api.completeOnboarding({ ...good, birthdate: 'garbage' }))).toBe('must_be_18');
    expect(await codeOf(api.completeOnboarding({ ...good, interestIds: [1, 2] }))).toBe('too_few_interests');
    expect(await codeOf(api.completeOnboarding({ ...good, interestIds: [1, 2, 99] }))).toBe('too_few_interests');
    expect(await codeOf(api.completeOnboarding({ ...good, homeCityId: 42 }))).toBe('city_invalid');
    // Nothing was saved by the failures.
    expect(await api.getMyProfile()).toBe(DEMO_PROFILE);
  });
});
