import { getFixtureEvent, getFixtureEventsInRange } from '../fixtures';
import { neighborhoodFor } from '../neighborhoods';

const START = new Date(2026, 10, 4);

it('assigns NoDa metadata to existing NoDa fixtures and excludes other neighborhoods', () => {
  const events = getFixtureEventsInRange(START, 14);
  const noda = events.filter((event) => neighborhoodFor(event)?.slug === 'noda');

  expect(noda.map((event) => event.id)).toEqual(expect.arrayContaining(['ev-004', 'ev-010', 'ev-004-w1', 'ev-010-w1']));
  expect(noda.every((event) => event.neighborhood === 'NoDa')).toBe(true);
  expect(noda.map((event) => event.id)).not.toContain('ev-005');
});

it('keeps repeated fixture locations unique and aligned between feed and event detail', () => {
  const events = getFixtureEventsInRange(START, 14);
  const first = events.find((event) => event.id === 'ev-004');
  const repeat = events.find((event) => event.id === 'ev-004-w1');
  const detail = getFixtureEvent('ev-004-w1', START);

  expect(first).toBeDefined();
  expect(repeat).toBeDefined();
  expect(repeat?.lat).not.toBe(first?.lat);
  expect(detail).toMatchObject({ lat: repeat?.lat, lng: repeat?.lng, neighborhood: repeat?.neighborhood });
});
