import { Alert } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { createEventInCalendarAsync } from 'expo-calendar/legacy';

import { addToCalendar, addToCalendarWithAlert } from '../calendar';
import type { EventDetail } from '../types';

jest.mock('expo', () => ({ isRunningInExpoGo: jest.fn() }));

jest.mock('expo-calendar/legacy', () => ({ createEventInCalendarAsync: jest.fn() }));

const calendar = jest.mocked(createEventInCalendarAsync);
const runningInExpoGo = jest.mocked(isRunningInExpoGo);
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

const event = {
  title: 'Sample event',
  startsAt: new Date('2026-11-06T21:00:00.000Z'),
  endsAt: new Date('2026-11-06T23:00:00.000Z'),
  venue: 'The venue',
  address: '123 Main St',
  description: 'A good time',
} as unknown as EventDetail;

function unavailableError() {
  return Object.assign(new Error('native method missing'), { code: 'ERR_UNAVAILABLE' });
}

beforeEach(() => {
  runningInExpoGo.mockReturnValue(false);
  calendar.mockReset();
  alert.mockClear();
});

describe('addToCalendar', () => {
  it('returns saved when the system event editor is accepted', async () => {
    calendar.mockResolvedValue({ action: 'saved' } as Awaited<ReturnType<typeof createEventInCalendarAsync>>);
    await expect(addToCalendar(event)).resolves.toBe('saved');
  });

  it('preserves cancellation without treating it as an error', async () => {
    calendar.mockResolvedValue({ action: 'canceled' } as Awaited<ReturnType<typeof createEventInCalendarAsync>>);
    await expect(addToCalendar(event)).resolves.toBe('canceled');
  });

  it('returns unsupported in Expo Go without loading the native module', async () => {
    runningInExpoGo.mockReturnValue(true);
    await expect(addToCalendar(event)).resolves.toBe('expoGoUnsupported');
    expect(calendar).not.toHaveBeenCalled();
  });

  it('keeps native failures generic', async () => {
    calendar.mockRejectedValue(new Error('calendar store unavailable'));
    await expect(addToCalendar(event)).resolves.toBe('error');
  });

  it('does not label a development build as Expo Go when the native method is unavailable', async () => {
    calendar.mockRejectedValue(unavailableError());
    await expect(addToCalendar(event)).resolves.toBe('error');
  });
});

describe('addToCalendarWithAlert', () => {
  it('uses accurate Expo Go guidance for the unsupported runtime', async () => {
    runningInExpoGo.mockReturnValue(true);
    await addToCalendarWithAlert(event);
    expect(alert).toHaveBeenCalledWith(
      'Calendar unavailable in Expo Go',
      'Open this event in an installed yard build to add it to your calendar.',
    );
  });

  it('does not guess that a generic native failure means permission was denied', async () => {
    calendar.mockRejectedValue(new Error('native failure'));
    await addToCalendarWithAlert(event);
    expect(alert).toHaveBeenCalledWith("Couldn't open your calendar", 'Please try again.');
  });
});
