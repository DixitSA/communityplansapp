import { eventRowDistance, eventRowTime } from '../components/EventRow';
import { formatAttendeeCount, formatCompactSpoken } from '../components/Facepile';
import { planButtonLabel, planMenuOptions, planPillSpec } from '../components/PlanPill';

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
    expect(formatAttendeeCount(3, 12)).toBe('+10');
    expect(formatAttendeeCount(5, 5)).toBe('+3'); // only two faces are drawn
    expect(formatAttendeeCount(2, 2)).toBe('');
  });

  it('shows only a count (never faces) when no friends are going', () => {
    expect(formatAttendeeCount(0, 7)).toBe('7 going');
    expect(formatAttendeeCount(0, 0)).toBe('');
  });
});

describe('quick plan button', () => {
  it('reflects the plan', () => {
    expect(planPillSpec(null)).toMatchObject({ symbol: 'plus', bg: 'surfaceMuted' });
    expect(planPillSpec('interested')).toMatchObject({ label: 'Interested', symbol: 'heart.fill' });
    expect(planPillSpec('down_if_friends')).toMatchObject({ label: 'Down if friends go', symbol: 'person.2.fill' });
    expect(planPillSpec('going')).toMatchObject({ label: 'Going', symbol: 'checkmark', bg: 'accent' });
  });

  it('says what it does to VoiceOver, since it shows only an icon', () => {
    expect(planButtonLabel(null, 'Trivia Night')).toBe('Make a plan for Trivia Night');
    expect(planButtonLabel('going', 'Trivia Night')).toBe('Trivia Night: Going. Change plan');
  });

  it('offers Clear only once there is a plan', () => {
    expect(planMenuOptions(null).map((o) => o.label)).toEqual(['Going', 'Down if friends go', 'Interested']);
    expect(planMenuOptions('interested').map((o) => o.label)).toEqual(['Going', 'Down if friends go', 'Interested', 'Clear']);
    expect(planMenuOptions('going').at(-1)?.plan).toBeNull();
  });
});

describe('formatCompactSpoken', () => {
  it('names friends and counts the rest as others', () => {
    expect(formatCompactSpoken(['Maya', 'Jordan'], 5)).toBe('Maya, Jordan and 3 others are going');
    expect(formatCompactSpoken(['Maya', 'Jordan'], 3)).toBe('Maya, Jordan and 1 other are going');
    expect(formatCompactSpoken(['Maya'], 1)).toBe('Maya is going');
    expect(formatCompactSpoken(['Maya', 'Jordan'], 2)).toBe('Maya and Jordan are going');
  });
  it('says N going with no friends', () => {
    expect(formatCompactSpoken([], 7)).toBe('7 going');
    expect(formatCompactSpoken([], 0)).toBe('');
  });
});
