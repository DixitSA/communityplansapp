import { fireEvent, render, screen } from '@testing-library/react-native';

import { EventCard, eventA11yLabel, planIndicator, type EventCardData } from '..';

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

describe('planIndicator', () => {
  it('fills the heart only for Interested, and the heart toggles', () => {
    const none = planIndicator(null, 'Party');
    const interested = planIndicator('interested', 'Party');
    expect(none).toMatchObject({ symbol: 'heart', action: 'toggle', accentFill: false });
    expect(interested).toMatchObject({ symbol: 'heart.fill', action: 'toggle', accentFill: false });
  });

  it('shows people for Down if friends go and opens the event', () => {
    expect(planIndicator('down_if_friends', 'Party')).toMatchObject({
      symbol: 'person.2.fill',
      action: 'open',
      accentFill: false,
    });
  });

  it('shows an accent check for Going and opens the event', () => {
    expect(planIndicator('going', 'Party')).toMatchObject({ symbol: 'checkmark', action: 'open', accentFill: true });
  });

  it('has a distinct VoiceOver label per state', () => {
    const labels = [null, 'interested', 'down_if_friends', 'going'].map(
      (p) => planIndicator(p as Parameters<typeof planIndicator>[0], 'Party').accessibilityLabel,
    );
    expect(new Set(labels).size).toBe(4);
    expect(labels.every((l) => l.includes('Party'))).toBe(true);
  });

  it('adds the plan to the card label', () => {
    expect(eventA11yLabel(event, 'going')).toContain("You're going.");
    expect(eventA11yLabel(event, 'down_if_friends')).toContain('Down if friends go.');
    expect(eventA11yLabel(event, 'interested')).toContain('Interested.');
    expect(eventA11yLabel(event, null)).not.toContain('Interested');
  });

  it.each([
    ['interested', 'toggle'],
    ['going', 'open'],
    ['down_if_friends', 'open'],
  ] as const)('routes a tap on the %s indicator to %s', async (plan, expected) => {
    const toggle = jest.fn();
    const open = jest.fn();
    await render(<EventCard event={event} plan={plan} onToggleInterested={toggle} onOpenPlan={open} />);
    fireEvent.press(screen.getByLabelText(planIndicator(plan, event.title).accessibilityLabel));
    expect(toggle).toHaveBeenCalledTimes(expected === 'toggle' ? 1 : 0);
    expect(open).toHaveBeenCalledTimes(expected === 'open' ? 1 : 0);
  });
});
