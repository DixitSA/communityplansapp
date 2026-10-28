import { getFixtureEvent, getFixtureEvents } from '@/features/feed/fixtures';

import { calendarEventDetails } from '../calendar';
import { directionsUrl, shareMessage } from '../actions';

const NOW = new Date(2026, 9, 28, 12, 0); // Wed, Oct 28 2026

describe('getFixtureEvent', () => {
  it('returns the card fields plus the page fields', () => {
    const e = getFixtureEvent('ev-005', NOW);
    expect(e).toBeDefined();
    expect(e?.title).toBe('Warehouse Party');
    expect(e?.description.length).toBeGreaterThan(20);
    expect(e?.address).toContain('Charlotte');
    expect(e?.host.name).toBeTruthy();
    expect(e?.priceLabel).toBeTruthy();
    expect(e?.source.name).toBeTruthy();
  });

  it('puts the primary category first in the tags', () => {
    const e = getFixtureEvent('ev-005', NOW);
    expect(e?.tags[0]).toEqual({ label: 'Nightlife', interest: 'nightlife' });
  });

  it('matches the feed card for the same id', () => {
    const card = getFixtureEvents(NOW).find((c) => c.id === 'ev-003');
    const detail = getFixtureEvent('ev-003', NOW);
    expect(detail?.startsAt).toEqual(card?.startsAt);
    expect(detail?.friendsGoing).toBe(card?.friendsGoing);
  });

  it('returns undefined for an unknown id', () => {
    expect(getFixtureEvent('nope', NOW)).toBeUndefined();
  });

  it('has page details for every feed event, and other attendees never exceed their total', () => {
    for (const card of getFixtureEvents(NOW)) {
      const e = getFixtureEvent(card.id, NOW);
      expect(e).toBeDefined();
      expect(e!.otherAttendees.length).toBeLessThanOrEqual(e!.othersGoing);
    }
  });
});

describe('event helpers', () => {
  const e = getFixtureEvent('ev-001', NOW)!;

  it('writes the share and invite messages', () => {
    expect(shareMessage(e, 'share')).toContain('Sunset Vinyl Hour');
    expect(shareMessage(e, 'invite')).toMatch(/^I'm going to Sunset Vinyl Hour on .* at Haberdish\. Come with me\?$/);
  });

  it('builds a directions link from the venue text only', () => {
    expect(directionsUrl(e)).toBe(`https://maps.apple.com/?q=${encodeURIComponent('Haberdish, 1218 Thomas Ave, Charlotte, NC')}`);
  });

  it('gives the calendar a two hour event at the venue', () => {
    const c = calendarEventDetails(e);
    expect(c.endDate.getTime() - c.startDate.getTime()).toBe(2 * 60 * 60 * 1000);
    expect(c.location).toContain('Haberdish');
  });
});
