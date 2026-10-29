import { ApiError } from '../errors';
import { DEMO_BAD_CODE, DEMO_INTERESTS, DEMO_PROFILE, createDemoApi } from '../demo';
import { CHARLOTTE_CITY_ID, type OnboardingInput, type SubmitEventInput } from '../types';

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

describe('demoFeedRange', () => {
  const { demoFeedRange } = jest.requireActual('../demo') as typeof import('../demo');
  const base = { cityId: 1, lat: 35.2, lng: -80.8, radiusM: 50 * 1609.344, price: 'any', mode: 'nearby' } as const;
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  it('covers the 14 days from start, earliest first, every row carrying its local day', () => {
    const start = new Date();
    const rows = demoFeedRange({ ...base, start: iso(start), days: 14 });
    expect(rows.length).toBeGreaterThan(10);
    expect(rows.every((r) => r.day === iso(r.startsAt))).toBe(true);
    expect(rows.map((r) => r.startsAt.getTime())).toEqual([...rows].map((r) => r.startsAt.getTime()).sort((a, b) => a - b));
    const first = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const end = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 14);
    expect(rows.every((r) => r.startsAt >= first && r.startsAt < end)).toBe(true);
    // Repeated weeks get distinct ids, so a list can key on them.
    expect(new Set(rows.map((r) => r.id)).size).toBe(rows.length);
  });

  it('applies the filters like the server (friends only, interests)', () => {
    const start = iso(new Date());
    const friends = demoFeedRange({ ...base, start, days: 14, mode: 'friends' });
    expect(friends.length).toBeGreaterThan(0);
    expect(friends.every((r) => r.friendsGoing > 0)).toBe(true);
    const music = demoFeedRange({ ...base, start, days: 14, interestIds: [2] });
    expect(music.every((r) => r.interest === 'music')).toBe(true);
  });

  it('clamps days to 1..14', () => {
    const start = iso(new Date());
    const one = demoFeedRange({ ...base, start, days: 1 });
    expect(new Set(one.map((r) => r.day)).size).toBeLessThanOrEqual(1);
    const many = demoFeedRange({ ...base, start, days: 99 });
    expect(many).toEqual(demoFeedRange({ ...base, start, days: 14 }));
  });

  it('serves the repeated-week events to the event page too', () => {
    const rows = demoFeedRange({ ...base, start: iso(new Date()), days: 14 });
    const repeat = rows.find((r) => r.id.includes('-w'));
    expect(repeat).toBeDefined();
    const { demoEvent } = jest.requireActual('../demo') as typeof import('../demo');
    expect(demoEvent(repeat!.id)?.id).toBe(repeat!.id);
  });

  describe('submitEvent', () => {
    const at = new Date(2026, 10, 1, 12, 0);
    const makeAt = () => createDemoApi({ delayMs: 0, now: () => at });
    const input = (over: Partial<SubmitEventInput> = {}): SubmitEventInput => ({
      cityId: CHARLOTTE_CITY_ID,
      title: ' Night market ',
      link: 'https://instagram.com/p/x',
      startsAt: new Date(at.getTime() + 48 * 3_600_000),
      venue: '',
      details: '',
      ...over,
    });

    it('stores a trimmed pending suggestion and lists it newest first', async () => {
      const api = makeAt();
      await api.submitEvent(input());
      await api.submitEvent(input({ title: 'Second' }));
      const mine = await api.getMySubmissions();
      expect(mine.map((s) => s.title)).toEqual(['Second', 'Night market']);
      expect(mine[0].status).toBe('pending');
    });

    it.each([
      ['title_invalid', { title: '  ' }],
      ['title_invalid', { title: 'a'.repeat(121) }],
      ['link_invalid', { link: 'http://a.com' }],
      ['link_invalid', { link: 'https://a.com/a b' }],
      ['starts_at_invalid', { startsAt: new Date(at.getTime() - 3_600_000) }],
      ['starts_at_invalid', { startsAt: new Date(at.getTime() + 366 * 24 * 3_600_000) }],
      ['city_invalid', { cityId: 999 }],
      ['venue_invalid', { venue: 'v'.repeat(121) }],
      ['details_invalid', { details: 'd'.repeat(1001) }],
    ] as const)('rejects with %s', async (code, over) => {
      expect(await codeOf(makeAt().submitEvent(input(over)))).toBe(code);
    });

    it('allows 5 in 24 hours, then rate_limited', async () => {
      const api = makeAt();
      for (let i = 0; i < 5; i++) await api.submitEvent(input());
      expect(await codeOf(api.submitEvent(input()))).toBe('rate_limited');
      expect(await api.getMySubmissions()).toHaveLength(5);
    });
  });
});
