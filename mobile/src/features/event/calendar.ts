import { Alert } from 'react-native';
import { isRunningInExpoGo } from 'expo';

import type { EventDetail } from './types';

/** Fallback duration for listings without a usable end time. */
export const DEFAULT_EVENT_HOURS = 2;

export function calendarEventDetails(event: EventDetail) {
  const endDate = event.endsAt && event.endsAt.getTime() > event.startsAt.getTime()
    ? event.endsAt
    : new Date(event.startsAt.getTime() + DEFAULT_EVENT_HOURS * 60 * 60 * 1000);
  return {
    title: event.title,
    startDate: event.startsAt,
    endDate,
    location: `${event.venue}, ${event.address}`,
    notes: `${event.description}\n\nAdded from yard.`,
  };
}

export type CalendarResult = 'saved' | 'canceled' | 'unavailable' | 'expoGoUnsupported' | 'error';

/** Opens the system "new event" screen, pre-filled, without reading the user's calendar. */
export async function addToCalendar(event: EventDetail): Promise<CalendarResult> {
  if (process.env.EXPO_OS === 'web') return 'unavailable';
  // expo-calendar 58 is not included in Expo Go; avoid calling its unavailable native module.
  if (isRunningInExpoGo()) return 'expoGoUnsupported';
  try {
    // Load on demand so the web path never touches the native module.
    // SDK 58's package-root legacy export intentionally throws; use the explicit legacy path.
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Keep the native module lazy behind the web guard.
    const Calendar = require('expo-calendar/legacy') as typeof import('expo-calendar/legacy');
    const result = await Calendar.createEventInCalendarAsync(calendarEventDetails(event));
    return result.action === 'canceled' ? 'canceled' : 'saved';
  } catch {
    return 'error';
  }
}

/** Runs addToCalendar and turns the unhappy outcomes into a friendly alert. */
export async function addToCalendarWithAlert(event: EventDetail): Promise<void> {
  const result = await addToCalendar(event);
  if (result === 'unavailable') {
    Alert.alert('Calendar not available here', 'Open yard on your iPhone to add this event to your calendar.');
  } else if (result === 'expoGoUnsupported') {
    Alert.alert('Calendar unavailable in Expo Go', 'Open this event in an installed yard build to add it to your calendar.');
  } else if (result === 'error') {
    Alert.alert("Couldn't open your calendar", 'Please try again.');
  }
}
