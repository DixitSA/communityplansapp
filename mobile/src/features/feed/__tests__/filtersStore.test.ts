import { useFiltersStore } from '../filtersStore';

describe('clearFilters', () => {
  it('resets every filter field but leaves scope, view and selectedDay alone', () => {
    const day = new Date(2030, 0, 5);
    const s = useFiltersStore.getState();
    s.setTimeOfDay('tonight');
    s.toggleInterest('music');
    s.setDistance(50);
    s.setPrice('free');
    s.setNeighborhood('noda');
    s.setScope('friends');
    s.setView('map');
    s.setSelectedDay(day);

    useFiltersStore.getState().clearFilters();

    const after = useFiltersStore.getState();
    expect(after.timeOfDay).toBe('any');
    expect(after.interests).toEqual([]);
    expect(after.distanceMi).toBe(10);
    expect(after.price).toBe('any');
    expect(after.neighborhood).toBeNull();
    expect(after.scope).toBe('friends');
    expect(after.view).toBe('map');
    expect(after.selectedDay).toBe(day);
  });
});
