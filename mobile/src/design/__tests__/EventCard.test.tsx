import { render, screen } from '@testing-library/react-native';

import { EventCard, eventA11yLabel, type EventCardData } from '..';
import { planButtonLabel } from '../components/PlanPill';

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

describe('EventCard plan button', () => {
  it('announces the plan button like the rows do', async () => {
    await render(<EventCard event={event} plan="going" />);
    expect(screen.getByLabelText(planButtonLabel('going', event.title))).toBeTruthy();
    expect(screen.getByLabelText(eventA11yLabel(event, 'going'))).toBeTruthy();
  });

  it('offers a plan when there is none', async () => {
    await render(<EventCard event={event} />);
    expect(screen.getByLabelText(planButtonLabel(null, event.title))).toBeTruthy();
  });

  it('adds the plan to the card label', () => {
    expect(eventA11yLabel(event, 'going')).toContain("You're going.");
    expect(eventA11yLabel(event, 'down_if_friends')).toContain('Down if friends go.');
    expect(eventA11yLabel(event, 'interested')).toContain('Interested.');
    expect(eventA11yLabel(event, null)).not.toContain('Interested');
  });
});

describe('EventCard spotlight reason', () => {
  const picked = { ...event, spotlightReason: 'yard pick' };
  it('adds the reason to the label and shows the pill', async () => {
    expect(eventA11yLabel(picked)).toContain('yard pick.');
    expect(eventA11yLabel({ ...event, spotlightReason: '7 going' })).toContain('7 going.');
    expect(eventA11yLabel(event)).not.toContain('yard pick');
    await render(<EventCard event={picked} size="compact" />);
    expect(screen.getByText('yard pick')).toBeTruthy();
    expect(screen.getByLabelText(eventA11yLabel(picked))).toBeTruthy();
  });
});
