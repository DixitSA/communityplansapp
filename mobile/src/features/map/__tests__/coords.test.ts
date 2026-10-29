import { getFixtureEvents } from '@/features/feed/fixtures';

import { JITTER_DEG, coordsForEvent, neighborhoodFor } from '../coords';

describe('neighborhoodFor', () => {
  it('matches venues by keyword and falls back to Uptown', () => {
    expect(neighborhoodFor('The District, South End').name).toBe('South End');
    expect(neighborhoodFor('Evening Muse, NoDa').name).toBe('NoDa');
    expect(neighborhoodFor('Camp North End').name).toBe('Camp North End');
    expect(neighborhoodFor('Plaza Midwood Studio').name).toBe('Plaza Midwood');
    expect(neighborhoodFor('Skye Bar, Uptown').name).toBe('Uptown');
    expect(neighborhoodFor('Somewhere new').name).toBe('Uptown');
  });
});

describe('coordsForEvent', () => {
  it('is deterministic for the same event', () => {
    const e = { id: 'ev-005', venue: 'The District, South End' };
    expect(coordsForEvent(e)).toEqual(coordsForEvent({ ...e }));
  });

  it('stays within the jitter radius of its neighborhood', () => {
    for (const e of getFixtureEvents(new Date(2026, 9, 28))) {
      const { center } = neighborhoodFor(e.venue);
      const c = coordsForEvent(e);
      expect(Math.abs(c.latitude - center.latitude)).toBeLessThanOrEqual(JITTER_DEG);
      expect(Math.abs(c.longitude - center.longitude)).toBeLessThanOrEqual(JITTER_DEG);
    }
  });

  it('gives events in the same neighborhood different pins', () => {
    const a = coordsForEvent({ id: 'ev-002', venue: 'Camp North End' });
    const b = coordsForEvent({ id: 'ev-008', venue: 'Camp North End' });
    expect(a).not.toEqual(b);
  });
});
