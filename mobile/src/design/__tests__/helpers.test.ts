import { eventA11yLabel, formatFriendsLabel, getWeekDays, type EventCardData } from '..';

describe('formatFriendsLabel', () => {
  it('handles one, two and many friends', () => {
    expect(formatFriendsLabel(['Maya'], 1)).toBe('Maya is going');
    expect(formatFriendsLabel(['Maya', 'Jordan'], 2)).toBe('Maya and Jordan are going');
    expect(formatFriendsLabel(['Maya', 'Jordan', 'Sam'], 5)).toBe('Maya, Jordan + 3 friends going');
    expect(formatFriendsLabel(['Maya', 'Jordan', 'Sam'], 3)).toBe('Maya, Jordan + 1 friend going');
    expect(formatFriendsLabel(['Maya'], 3)).toBe('Maya + 2 friends going');
  });

  it('returns an empty string when nobody is going', () => {
    expect(formatFriendsLabel([], 0)).toBe('');
  });
});

describe('getWeekDays', () => {
  it('returns Monday to Sunday for any day in the week', () => {
    // Wednesday 28 Oct 2026
    const days = getWeekDays(new Date(2026, 9, 28, 15, 30));
    expect(days).toHaveLength(7);
    expect(days.map((d) => d.getDate())).toEqual([26, 27, 28, 29, 30, 31, 1]);
    expect(days[0].getDay()).toBe(1);
    expect(days[6].getDay()).toBe(0);
    expect(days[0].getHours()).toBe(0);
  });

  it('treats Sunday as the last day of its week', () => {
    const days = getWeekDays(new Date(2026, 10, 1));
    expect(days[0].getDate()).toBe(26);
    expect(days[6].getDate()).toBe(1);
  });
});

describe('eventA11yLabel', () => {
  const event: EventCardData = {
    id: 'e1',
    title: 'Warehouse Party',
    startsAt: new Date(2026, 9, 28, 21, 0),
    venue: 'The District',
    distanceMi: 2.1,
    interest: 'nightlife',
    symbol: 'moon.stars.fill',
    categoryLabel: 'Nightlife',
    friends: [{ id: 'b', name: 'Bob' }, { id: 'c', name: 'Carol' }],
    friendsGoing: 2,
  };

  it('reads as one sentence group', () => {
    expect(eventA11yLabel(event)).toBe(
      'Warehouse Party, Wednesday 9 PM, The District, 2.1 miles. Bob and Carol are going.',
    );
  });

  it('omits friends when none and appends Saved', () => {
    expect(eventA11yLabel({ ...event, friends: [], friendsGoing: 0 }, true)).toBe(
      'Warehouse Party, Wednesday 9 PM, The District, 2.1 miles. Saved.',
    );
  });
});
