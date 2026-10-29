import { createDemoApi } from '../demo';
import { normalizeSearchQuery } from '../friendsMapping';
import { ApiError } from '../errors';

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return null;
  } catch (e) {
    return e instanceof ApiError ? e.code : 'not-an-api-error';
  }
};

describe('demo friends', () => {
  const make = () => createDemoApi({ delayMs: 0, now: () => new Date('2026-10-29T12:00:00Z') });

  it('normalizes a search like the server: trim and drop one leading @', () => {
    expect(normalizeSearchQuery('  @Maya ')).toBe('Maya');
    expect(normalizeSearchQuery('@ ')).toBe('');
  });

  it('answers nothing under 2 characters and rejects over 30', async () => {
    const api = make();
    expect(await api.searchProfiles('m')).toEqual([]);
    expect(await api.searchProfiles('@m')).toEqual([]);
    expect(await codeOf(api.searchProfiles('x'.repeat(31)))).toBe('query_invalid');
  });

  it('finds people by name or username and reports the friendship', async () => {
    const api = make();
    const byName = await api.searchProfiles('maya');
    expect(byName[0]).toMatchObject({ id: 'u-maya', friendship: 'friends' });
    const byHandle = await api.searchProfiles('@noah.k');
    expect(byHandle.map((r) => [r.id, r.friendship])).toEqual([['u-noah', 'incoming']]);
    expect(await api.searchProfiles('zzzz')).toEqual([]);
  });

  it('sends a request, then refuses a second one', async () => {
    const api = make();
    expect(await api.sendFriendRequest('u-ana')).toBe('outgoing');
    expect((await api.listFriendRequests()).find((r) => r.id === 'u-ana')?.direction).toBe('outgoing');
    expect(await codeOf(api.sendFriendRequest('u-ana'))).toBe('request_pending');
  });

  it('turns a request to someone who already asked you into a friendship', async () => {
    const api = make();
    expect(await api.sendFriendRequest('u-noah')).toBe('friends');
    expect((await api.listFriends()).some((f) => f.id === 'u-noah')).toBe(true);
  });

  it('raises the server error codes', async () => {
    const api = make();
    expect(await codeOf(api.sendFriendRequest('demo-user'))).toBe('cannot_friend_self');
    expect(await codeOf(api.sendFriendRequest('nobody'))).toBe('user_not_found');
    expect(await codeOf(api.sendFriendRequest('u-maya'))).toBe('already_friends');
    expect(await codeOf(api.respondFriendRequest('u-ana', true))).toBe('request_not_found');
    // Only the recipient can respond: not to a request you sent.
    expect(await codeOf(api.respondFriendRequest('u-eli', true))).toBe('request_not_found');
  });

  it('accepts and declines incoming requests', async () => {
    const api = make();
    expect(await api.respondFriendRequest('u-noah', true)).toBe('friends');
    expect((await api.listFriendRequests()).some((r) => r.id === 'u-noah')).toBe(false);
    const other = make();
    expect(await other.respondFriendRequest('u-noah', false)).toBe('none');
    expect((await other.getUserProfile('u-noah'))?.friendship).toBe('none');
  });

  it('removes a friend and cancels an outgoing request', async () => {
    const api = make();
    await api.removeFriend('u-maya');
    await api.removeFriend('u-eli');
    expect((await api.listFriends()).some((f) => f.id === 'u-maya')).toBe(false);
    expect((await api.listFriendRequests()).some((r) => r.id === 'u-eli')).toBe(false);
  });

  it('lists friends by name and requests newest first', async () => {
    const api = make();
    const names = (await api.listFriends()).map((f) => f.displayName);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
    const times = (await api.listFriendRequests()).map((r) => r.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it('returns a profile with counts and shared events, newest first', async () => {
    const api = make();
    const maya = await api.getUserProfile('u-maya');
    expect(maya).toMatchObject({ friendship: 'friends', mutualFriendCount: 6 });
    expect(maya?.sharedEvents.length).toBe(2);
    const times = maya?.sharedEvents.map((e) => e.startsAt.getTime()) ?? [];
    expect(times[0]).toBeGreaterThan(times[1]);
    expect(maya?.sharedEvents.every((e) => e.startsAt.getTime() < new Date('2026-10-29T12:00:00Z').getTime())).toBe(true);
  });

  it('knows self and unknown people', async () => {
    const api = make();
    expect((await api.getUserProfile('demo-user'))?.friendship).toBe('self');
    expect(await api.getUserProfile('nobody')).toBeNull();
  });

  it('hides a blocked person everywhere', async () => {
    const api = make();
    await api.blockUser('u-maya');
    expect(await api.getUserProfile('u-maya')).toBeNull();
    expect((await api.searchProfiles('maya')).length).toBe(0);
    expect((await api.listFriends()).some((f) => f.id === 'u-maya')).toBe(false);
    expect(await codeOf(api.sendFriendRequest('u-maya'))).toBe('user_not_found');
  });
});
