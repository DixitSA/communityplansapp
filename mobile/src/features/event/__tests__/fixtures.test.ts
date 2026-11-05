import { Alert, Linking } from 'react-native';

import { getFixtureEvent, getFixtureEvents } from '@/features/feed/fixtures';

import { calendarEventDetails } from '../calendar';
import { directionsUrl, openEventListing, shareMessage } from '../actions';

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
    expect(shareMessage(e, 'share', null)).toContain('Sunset Vinyl Hour');
    expect(shareMessage(e, 'share', null)).not.toContain('Get yard');
    expect(shareMessage(e, 'share', 'https://apps.apple.com/app/id1')).toMatch(/Found on yard\.\n\nGet yard: https:\/\/apps\.apple\.com\/app\/id1$/);
    expect(shareMessage(e, 'invite', null)).toMatch(/^I'm going to Sunset Vinyl Hour on .* at Haberdish\. Come with me\?$/);
  });

  it('builds a directions link from the venue text only', () => {
    expect(directionsUrl(e)).toBe(`https://maps.apple.com/?q=${encodeURIComponent('Haberdish, 1218 Thomas Ave, Charlotte, NC')}`);
  });

  it('uses the listed end time for overnight calendar events', () => {
    const event = getFixtureEvent('ev-005', NOW)!;
    expect(event.endsAt).toBeDefined();
    expect(calendarEventDetails(event).endDate).toEqual(event.endsAt);
  });

  it('gives the calendar a two hour fallback when the end is missing or invalid', () => {
    for (const endsAt of [undefined, new Date('invalid'), new Date(e.startsAt.getTime() - 1)]) {
      const c = calendarEventDetails({ ...e, endsAt });
      expect(c.endDate.getTime() - c.startDate.getTime()).toBe(2 * 60 * 60 * 1000);
      expect(c.location).toContain('Haberdish');
    }
  });
});

describe('openEventListing', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('opens the original listing without showing an error', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await openEventListing('https://tickets.example/event');

    expect(openURL).toHaveBeenCalledWith('https://tickets.example/event');
    expect(alert).not.toHaveBeenCalled();
  });

  it('shows a native message when the system cannot open the listing', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('unsupported URL'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

    await openEventListing('https://tickets.example/event');

    expect(alert).toHaveBeenCalledWith("Couldn't open this listing", 'Try again in a moment.');
  });
});
