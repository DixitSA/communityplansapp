import { render, screen } from '@testing-library/react-native';

import { EventRow, HotBadge, POPPING_THRESHOLD, isPopping, type EventCardData } from '..';

const event: EventCardData = {
  id: 'e1',
  title: 'Warehouse Party',
  startsAt: new Date(2026, 9, 28, 21, 0),
  venue: 'The District',
  distanceMi: 2.1,
  interest: 'nightlife',
  symbol: 'moon.stars.fill',
  categoryLabel: 'Nightlife',
  friends: [],
  friendsGoing: 0,
};

describe('isPopping', () => {
  it('needs a real count at or above the threshold', () => {
    expect(isPopping(POPPING_THRESHOLD)).toBe(true);
    expect(isPopping(POPPING_THRESHOLD - 1)).toBe(false);
    expect(isPopping(0)).toBe(false);
  });

  it('never invents heat from an unknown count', () => {
    expect(isPopping(null)).toBe(false);
    expect(isPopping(undefined)).toBe(false);
  });
});

describe('HotBadge', () => {
  it('shows its label', async () => {
    await render(<HotBadge label="Popping" />);
    expect(screen.getByText('Popping')).toBeTruthy();
  });
});

describe('EventRow popping badge', () => {
  it('shows only when lots are going, and not on live rows', async () => {
    const { rerender } = await render(<EventRow event={{ ...event, goingCount: POPPING_THRESHOLD }} />);
    expect(screen.getByLabelText(/^Popping\. /)).toBeTruthy();
    await rerender(<EventRow event={{ ...event, goingCount: POPPING_THRESHOLD - 1 }} />);
    expect(screen.queryByLabelText(/^Popping\. /)).toBeNull();
    await rerender(<EventRow event={{ ...event, goingCount: 20, liveUntil: new Date(2026, 9, 28, 23, 0) }} />);
    expect(screen.queryByLabelText(/^Popping\. /)).toBeNull();
  });
});
