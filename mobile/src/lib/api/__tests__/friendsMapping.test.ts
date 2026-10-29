import {
  mapFriendRow,
  mapProfileRow,
  mapRequestRow,
  mapSearchRow,
  parseSharedEvents,
  toFriendship,
  type ProfileRow,
} from '../friendsMapping';

const publicUrl = (path: string | null | undefined) => (path ? `https://cdn.test/avatars/${path}` : null);
const nullable = <T,>(v: null) => v as unknown as T;

describe('toFriendship', () => {
  it('passes the four known states through', () => {
    for (const f of ['none', 'friends', 'outgoing', 'incoming'] as const) expect(toFriendship(f)).toBe(f);
  });
  it('reads anything else as none, never as friends', () => {
    expect(toFriendship('self')).toBe('none');
    expect(toFriendship('weird')).toBe('none');
    expect(toFriendship(null)).toBe('none');
  });
});

describe('row mapping', () => {
  const base = { id: 'u1', username: 'maya.chen', display_name: 'Maya Chen', avatar_path: 'u1/a.jpg' };

  it('maps a search row to camelCase with a public avatar URL', () => {
    expect(mapSearchRow({ ...base, friendship: 'incoming' }, publicUrl)).toEqual({
      id: 'u1',
      username: 'maya.chen',
      displayName: 'Maya Chen',
      avatarUrl: 'https://cdn.test/avatars/u1/a.jpg',
      friendship: 'incoming',
    });
  });

  it('gives null for a missing avatar', () => {
    const r = mapSearchRow({ ...base, avatar_path: nullable<string>(null), friendship: 'none' }, publicUrl);
    expect(r.avatarUrl).toBeNull();
  });

  it('maps friends with a Date for since', () => {
    const f = mapFriendRow({ ...base, since: '2026-10-01T12:00:00Z' }, publicUrl);
    expect(f.since).toEqual(new Date('2026-10-01T12:00:00Z'));
  });

  it('maps request direction and treats unknown as incoming', () => {
    expect(mapRequestRow({ ...base, direction: 'outgoing', created_at: '2026-10-02T00:00:00Z' }, publicUrl).direction).toBe('outgoing');
    expect(mapRequestRow({ ...base, direction: 'incoming', created_at: '2026-10-02T00:00:00Z' }, publicUrl).direction).toBe('incoming');
    expect(mapRequestRow({ ...base, direction: '??', created_at: '2026-10-02T00:00:00Z' }, publicUrl).direction).toBe('incoming');
  });
});

describe('parseSharedEvents', () => {
  it('keeps well-formed entries and drops the rest', () => {
    const out = parseSharedEvents([
      { id: 'e1', title: 'Warehouse Party', starts_at: '2026-10-01T22:00:00Z' },
      { id: 'e2', title: 'No date' },
      null,
      'nope',
      { id: 'e3', title: 'Bad date', starts_at: 'not a date' },
    ]);
    expect(out).toEqual([{ id: 'e1', title: 'Warehouse Party', startsAt: new Date('2026-10-01T22:00:00Z') }]);
  });
  it('returns an empty list for non-arrays', () => {
    expect(parseSharedEvents(null)).toEqual([]);
    expect(parseSharedEvents({})).toEqual([]);
  });
});

describe('mapProfileRow', () => {
  const row: ProfileRow = {
    id: 'u1',
    username: 'maya.chen',
    display_name: 'Maya Chen',
    avatar_path: nullable<string>(null),
    bio: '  Vinyl and patios.  ',
    friendship: 'self',
    friend_count: 12,
    mutual_friend_count: 3,
    shared_events: [{ id: 'e1', title: 'Warehouse Party', starts_at: '2026-10-01T22:00:00Z' }],
  };

  it('maps counts, trims the bio and keeps self', () => {
    const p = mapProfileRow(row, publicUrl);
    expect(p.friendship).toBe('self');
    expect(p.bio).toBe('Vinyl and patios.');
    expect(p.friendCount).toBe(12);
    expect(p.mutualFriendCount).toBe(3);
    expect(p.sharedEvents).toHaveLength(1);
  });

  it('turns an empty bio into null', () => {
    expect(mapProfileRow({ ...row, bio: '   ' }, publicUrl).bio).toBeNull();
    expect(mapProfileRow({ ...row, bio: nullable<string>(null) }, publicUrl).bio).toBeNull();
  });
});
