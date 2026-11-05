import { Alert, Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { PermissionStatus } from 'expo-modules-core';
import { createEventInCalendarAsync, requestCalendarPermissionsAsync } from 'expo-calendar/legacy';

import { addToCalendar, addToCalendarWithAlert } from '../calendar';
import type { EventDetail } from '../types';

jest.mock('expo', () => ({ isRunningInExpoGo: jest.fn() }));

jest.mock('expo-calendar/legacy', () => ({
  createEventInCalendarAsync: jest.fn(),
  requestCalendarPermissionsAsync: jest.fn(),
}));

const calendar = jest.mocked(createEventInCalendarAsync);
const requestCalendarPermission = jest.mocked(requestCalendarPermissionsAsync);
const runningInExpoGo = jest.mocked(isRunningInExpoGo);
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
const platformVersion = jest.spyOn(Platform, 'Version', 'get');

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
  process.env.EXPO_OS = 'ios';
  Object.assign(Platform, { OS: 'ios' });
  platformVersion.mockReturnValue(17);
  runningInExpoGo.mockReturnValue(false);
  calendar.mockReset();
  requestCalendarPermission.mockReset();
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

  it('requests calendar permission on iOS 16 before opening the event editor', async () => {
    platformVersion.mockReturnValue('16.7.2');
    requestCalendarPermission.mockResolvedValue({
      status: PermissionStatus.GRANTED, granted: true, canAskAgain: true, expires: 'never',
    });
    calendar.mockResolvedValue({ action: 'saved' } as Awaited<ReturnType<typeof createEventInCalendarAsync>>);

    await expect(addToCalendar(event)).resolves.toBe('saved');
    expect(requestCalendarPermission).toHaveBeenCalledTimes(1);
    expect(calendar).toHaveBeenCalledTimes(1);
  });

  it('stops on a denied iOS 16 calendar permission without opening the editor', async () => {
    platformVersion.mockReturnValue('16.7.1');
    requestCalendarPermission.mockResolvedValue({
      status: PermissionStatus.DENIED, granted: false, canAskAgain: false, expires: 'never',
    });

    await expect(addToCalendar(event)).resolves.toBe('permissionDenied');
    expect(requestCalendarPermission).toHaveBeenCalledTimes(1);
    expect(calendar).not.toHaveBeenCalled();
  });

  it('does not request calendar permission on iOS 17 before opening the system editor', async () => {
    platformVersion.mockReturnValue('17.0.1');
    calendar.mockResolvedValue({ action: 'saved' } as Awaited<ReturnType<typeof createEventInCalendarAsync>>);

    await expect(addToCalendar(event)).resolves.toBe('saved');
    expect(requestCalendarPermission).not.toHaveBeenCalled();
    expect(calendar).toHaveBeenCalledTimes(1);
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

  it('explains a confirmed calendar permission denial', async () => {
    platformVersion.mockReturnValue('16.7.2');
    requestCalendarPermission.mockResolvedValue({
      status: PermissionStatus.DENIED, granted: false, canAskAgain: false, expires: 'never',
    });
    await addToCalendarWithAlert(event);
    expect(alert).toHaveBeenCalledWith(
      'Calendar access needed',
      'Allow calendar access in Settings to add this event.',
    );
  });
});
