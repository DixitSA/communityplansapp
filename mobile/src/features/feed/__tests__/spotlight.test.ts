import { DEFAULT_CRITERIA } from '../filters';
import { filterSpotlight } from '../spotlight';

const at = (h: number) => new Date(2030, 0, 1, h);
const ev = (id: string, o: object = {}) => ({
  id,
  startsAt: at(19),
  interest: 'music',
  friendsGoing: 0,
  distanceMi: 2,
  priceUsd: 0,
  ...o,
});

const ids = (list: { id: string }[]) => list.map((e) => e.id);

describe('filterSpotlight', () => {
  const events = [
    ev('a'),
    ev('b', { interest: 'fitness', priceUsd: 20, friendsGoing: 2 }),
    ev('c', { startsAt: at(9), distanceMi: 30 }),
  ];
  it('drops out-of-range distance with default filters', () => {
    expect(ids(filterSpotlight(events, DEFAULT_CRITERIA, null))).toEqual(['a', 'b']);
  });
  it('applies scope, price, interests, distance and time', () => {
    expect(ids(filterSpotlight(events, { ...DEFAULT_CRITERIA, scope: 'friends' }, null))).toEqual(['b']);
    expect(ids(filterSpotlight(events, { ...DEFAULT_CRITERIA, price: 'free' }, null))).toEqual(['a']);
    expect(ids(filterSpotlight(events, { ...DEFAULT_CRITERIA, interests: ['fitness'] }, null))).toEqual(['b']);
    expect(ids(filterSpotlight(events, { ...DEFAULT_CRITERIA, distanceMi: 50, timeOfDay: 'morning' }, null))).toEqual(['c']);
  });
  it('drops everything for a neighborhood nothing is in', () => {
    expect(filterSpotlight(events, DEFAULT_CRITERIA, 'no-such-hood')).toEqual([]);
  });
});
