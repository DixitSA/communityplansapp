import { derivePriceUsd } from '../derive';
import {
  DEFAULT_CRITERIA,
  applyFilters,
  chipStates,
  isDefaultFilters,
  type FilterCriteria,
  type FilterableEvent,
} from '../filters';
import { useFiltersStore } from '../filtersStore';

const at = (hour: number) => new Date(2026, 9, 28, hour, 0);
const ev = (id: string, o: Partial<FilterableEvent> = {}): FilterableEvent => ({
  id,
  startsAt: at(20),
  interest: 'music',
  friendsGoing: 0,
  distanceMi: 2,
  priceUsd: 0,
  ...o,
});
const f = (o: Partial<FilterCriteria> = {}): FilterCriteria => ({ ...DEFAULT_CRITERIA, ...o });
const ids = (events: FilterableEvent[]) => events.map((e) => e.id);

describe('applyFilters', () => {
  it('keeps everything within 10 mi at the defaults', () => {
    const events = [ev('a'), ev('b', { distanceMi: 11 })];
    expect(ids(applyFilters(events, f()))).toEqual(['a']);
  });

  it('splits the day into morning, afternoon and tonight (5 PM and later)', () => {
    const events = [ev('am', { startsAt: at(9) }), ev('noon', { startsAt: at(12) }), ev('4pm', { startsAt: at(16) }), ev('5pm', { startsAt: at(17) }), ev('late', { startsAt: at(23) })];
    expect(ids(applyFilters(events, f({ timeOfDay: 'morning' })))).toEqual(['am']);
    expect(ids(applyFilters(events, f({ timeOfDay: 'afternoon' })))).toEqual(['noon', '4pm']);
    expect(ids(applyFilters(events, f({ timeOfDay: 'tonight' })))).toEqual(['5pm', 'late']);
    expect(applyFilters(events, f({ timeOfDay: 'any' }))).toHaveLength(5);
  });

  it('filters by interest, treating an empty list as all', () => {
    const events = [ev('m'), ev('n', { interest: 'nightlife' }), ev('f', { interest: 'fitness' })];
    expect(ids(applyFilters(events, f({ interests: ['music', 'fitness'] })))).toEqual(['m', 'f']);
    expect(applyFilters(events, f({ interests: [] }))).toHaveLength(3);
  });

  it('filters by distance', () => {
    const events = [ev('near', { distanceMi: 0.8 }), ev('mid', { distanceMi: 4 }), ev('far', { distanceMi: 20 })];
    expect(ids(applyFilters(events, f({ distanceMi: 1 })))).toEqual(['near']);
    expect(ids(applyFilters(events, f({ distanceMi: 5 })))).toEqual(['near', 'mid']);
    expect(ids(applyFilters(events, f({ distanceMi: 25 })))).toEqual(['near', 'mid', 'far']);
  });

  it('filters by price', () => {
    const events = [ev('free', { priceUsd: 0 }), ev('paid', { priceUsd: 15 })];
    expect(ids(applyFilters(events, f({ price: 'free' })))).toEqual(['free']);
    expect(ids(applyFilters(events, f({ price: 'paid' })))).toEqual(['paid']);
    expect(applyFilters(events, f({ price: 'any' }))).toHaveLength(2);
  });

  it('shows only events with friends going in the Friends scope', () => {
    const events = [ev('a', { friendsGoing: 2 }), ev('b')];
    expect(ids(applyFilters(events, f({ scope: 'friends' })))).toEqual(['a']);
  });

  it('combines filters and does not mutate the input', () => {
    const events = [ev('a', { interest: 'music', startsAt: at(20) }), ev('b', { interest: 'music', startsAt: at(9) })];
    const copy = [...events];
    expect(ids(applyFilters(events, f({ interests: ['music'], timeOfDay: 'tonight' })))).toEqual(['a']);
    expect(events).toEqual(copy);
  });

  it('derives missing price and distance the same way every time', () => {
    const bare = { id: 'ev-xyz', startsAt: at(20), interest: 'music', friendsGoing: 0 };
    const a = applyFilters([bare], f({ price: 'free', distanceMi: 50 })).length;
    const b = applyFilters([bare], f({ price: 'free', distanceMi: 50 })).length;
    expect(a).toBe(b);
    expect(derivePriceUsd('ev-xyz')).toBe(derivePriceUsd('ev-xyz'));
    // Free and paid are exact opposites for derived prices.
    const free = applyFilters([bare], f({ price: 'free', distanceMi: 50 })).length;
    const paid = applyFilters([bare], f({ price: 'paid', distanceMi: 50 })).length;
    expect(free + paid).toBe(1);
  });
});

describe('chipStates', () => {
  it('shows defaults as inactive', () => {
    const c = chipStates(f());
    expect(c.time).toEqual({ label: 'Any time', active: false });
    expect(c.interests).toEqual({ label: 'Interests', active: false });
    expect(c.distance).toEqual({ label: '10 mi', active: false });
    expect(isDefaultFilters(f())).toBe(true);
  });

  it('labels and activates chips that were changed', () => {
    expect(chipStates(f({ timeOfDay: 'tonight' })).time).toEqual({ label: 'Tonight', active: true });
    expect(chipStates(f({ distanceMi: 25 })).distance).toEqual({ label: '25 mi', active: true });
    expect(chipStates(f({ interests: ['music'] })).interests).toEqual({ label: 'Music', active: true });
    expect(chipStates(f({ interests: ['music', 'fitness'] })).interests).toEqual({ label: 'Interests · 2', active: true });
    expect(isDefaultFilters(f({ distanceMi: 1 }))).toBe(false);
  });

  it('lights the Interests chip when only price is set, since the sheet holds price', () => {
    expect(chipStates(f({ price: 'free' })).interests.active).toBe(true);
  });
});

describe('filters store', () => {
  it('toggles interests and clears filters without touching the scope or view', () => {
    const s = useFiltersStore.getState();
    s.setScope('friends');
    s.setView('map');
    s.toggleInterest('music');
    s.toggleInterest('fitness');
    s.toggleInterest('music');
    s.setDistance(1);
    s.setPrice('free');
    s.setTimeOfDay('morning');
    expect(useFiltersStore.getState().interests).toEqual(['fitness']);
    useFiltersStore.getState().clearFilters();
    const after = useFiltersStore.getState();
    expect(after.interests).toEqual([]);
    expect(after.distanceMi).toBe(10);
    expect(after.price).toBe('any');
    expect(after.timeOfDay).toBe('any');
    expect(after.scope).toBe('friends');
    expect(after.view).toBe('map');
  });
});
