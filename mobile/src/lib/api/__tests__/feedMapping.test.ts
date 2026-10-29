import { DEMO_INTERESTS, createDemoApi } from '../demo';
import { METERS_PER_MILE, mapFeedRow, priceLabel, type FeedRow } from '../feedMapping';

const row: FeedRow = {
  id: 'e1',
  title: 'Sunset Vinyl Hour',
  starts_at: '2026-10-29T22:30:00Z',
  ends_at: null as unknown as string,
  venue_name: 'Haberdish',
  neighborhood: 'NoDa',
  image_url: null as unknown as string,
  is_free: true,
  price_min: null as unknown as number,
  lat: 35.25,
  lng: -80.8,
  distance_m: METERS_PER_MILE * 2.5,
  interest_ids: [3, 2],
  going_count: 7,
  friends_going: [
    { id: 'u1', display_name: 'Maya', avatar_path: null },
    { id: 'u2', display_name: 'Jordan', avatar_path: null },
  ],
  my_status: null as unknown as FeedRow['my_status'],
  score: 1,
};

describe('mapFeedRow', () => {
  const e = mapFeedRow(row, DEMO_INTERESTS);

  it('converts meters to miles', () => {
    expect(e.distanceMi).toBeCloseTo(2.5);
  });

  it('turns interest ids into the primary slug, label and symbol (display order wins)', () => {
    expect(e.interest).toBe('music');
    expect(e.categoryLabel).toBe('Music');
    expect(e.symbol).toBe('music.note');
  });

  it('maps friends, counts, coordinates and status', () => {
    expect(e.friends).toEqual([
      { id: 'u1', name: 'Maya' },
      { id: 'u2', name: 'Jordan' },
    ]);
    expect(e.friendsGoing).toBe(2);
    expect(e.goingCount).toBe(7);
    expect(e.myStatus).toBeNull();
    expect([e.lat, e.lng]).toEqual([35.25, -80.8]);
    expect(e.imageUrl).toBeUndefined();
    expect(e.venue).toBe('Haberdish');
  });

  it('keeps a real status and survives malformed friends', () => {
    const m = mapFeedRow({ ...row, my_status: 'going', friends_going: null }, DEMO_INTERESTS);
    expect(m.myStatus).toBe('going');
    expect(m.friends).toEqual([]);
  });
});

describe('priceLabel', () => {
  it('formats free, single and ranged prices', () => {
    expect(priceLabel({ is_free: true, price_min: null, price_max: null })).toBe('Free');
    expect(priceLabel({ is_free: false, price_min: 15, price_max: null })).toBe('$15');
    expect(priceLabel({ is_free: false, price_min: 20, price_max: 35 })).toBe('$20 to $35');
  });
});

describe('demo api', () => {
  const api = createDemoApi({ delayMs: 0 });
  const base = { cityId: 1, day: '2026-10-29', lat: 0, lng: 0, radiusM: 10 * METERS_PER_MILE, price: 'any', mode: 'nearby' } as const;

  it('returns the sample fixtures', async () => {
    const all = await api.getFeed(base);
    expect(all).toHaveLength(10);
    expect(all[0].id).toBe('ev-001');
  });

  it('applies the filters like the server would', async () => {
    const friends = await api.getFeed({ ...base, mode: 'friends' });
    expect(friends.every((e) => e.friendsGoing > 0)).toBe(true);
    const music = await api.getFeed({ ...base, interestIds: [2] });
    expect(music.every((e) => e.interest === 'music')).toBe(true);
  });

  it('serves a sample event page and null for unknown ids', async () => {
    expect((await api.getEvent('ev-005'))?.goingCount).toBeNull();
    expect(await api.getEvent('00000000-0000-0000-0000-000000000000')).toBeNull();
  });
});
