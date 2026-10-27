import { render, screen } from '@testing-library/react-native';

import { EventCard, eventA11yLabel, type EventCardData } from '..';

const event: EventCardData = {
  id: 'e1',
  title: 'Warehouse Party',
  startsAt: new Date(2026, 9, 28, 21, 0),
  venue: 'The District',
  distanceMi: 2.1,
  interest: 'nightlife',
  symbol: 'moon.stars.fill',
  categoryLabel: 'Nightlife',
  friends: [{ id: 'm', name: 'Maya' }],
  friendsGoing: 1,
};

describe('EventCard', () => {
  it('is a single accessible element with the composed label', async () => {
    await render(<EventCard event={event} />);
    expect(screen.getByLabelText(eventA11yLabel(event))).toBeTruthy();
  });

  it('shows the meta line', async () => {
    await render(<EventCard event={event} />);
    expect(screen.getByText('Wed, Oct 28 · 9:00 PM')).toBeTruthy();
    expect(screen.getByText('The District · 2.1 mi')).toBeTruthy();
  });
});
