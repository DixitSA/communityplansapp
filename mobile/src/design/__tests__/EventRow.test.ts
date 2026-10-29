import { eventRowDistance, eventRowTime } from '../components/EventRow';
import { formatAttendeeCount } from '../components/Facepile';
import { planMenuOptions, planPillSpec } from '../components/PlanPill';

describe('EventRow text', () => {
  it('shows a time range when the end is known, else just the start', () => {
    const startsAt = new Date(2026, 9, 29, 18, 0);
    expect(eventRowTime({ startsAt, endsAt: new Date(2026, 9, 29, 21, 0) })).toBe('6:00 – 9:00 PM');
    expect(eventRowTime({ startsAt })).toBe('6:00 PM');
  });

  it('formats the distance to one decimal', () => {
    expect(eventRowDistance({ distanceMi: 0.8 })).toBe('0.8 mi');
    expect(eventRowDistance({ distanceMi: 1.44 })).toBe('1.4 mi');
  });
});

describe('formatAttendeeCount', () => {
  it('shows "+N" beyond the friends\' faces', () => {
    expect(formatAttendeeCount(3, 12)).toBe('+9');
    expect(formatAttendeeCount(5, 5)).toBe('+2'); // only three faces are drawn
    expect(formatAttendeeCount(2, 2)).toBe('');
  });

  it('shows only a count (never faces) when no friends are going', () => {
    expect(formatAttendeeCount(0, 7)).toBe('7 going');
    expect(formatAttendeeCount(0, 0)).toBe('');
  });
});

describe('quick plan button', () => {
  it('reflects the plan', () => {
    expect(planPillSpec(null)).toMatchObject({ label: 'Join', bg: 'accent' });
    expect(planPillSpec('interested')).toMatchObject({ label: 'Interested', bg: 'surfaceMuted' });
    expect(planPillSpec('down_if_friends').label).toBe('Down if');
    expect(planPillSpec('going')).toMatchObject({ label: 'Going', check: true });
  });

  it('offers Clear only once there is a plan', () => {
    expect(planMenuOptions(null).map((o) => o.label)).toEqual(['Going', 'Down if friends go', 'Interested']);
    expect(planMenuOptions('interested').map((o) => o.label)).toEqual(['Going', 'Down if friends go', 'Interested', 'Clear']);
    expect(planMenuOptions('going').at(-1)?.plan).toBeNull();
  });
});
