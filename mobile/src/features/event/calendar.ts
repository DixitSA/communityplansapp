import { Alert } from 'react-native';

import type { EventDetail } from './types';

/** Events don't list an end time yet, so calendar entries last two hours. */
export const DEFAULT_EVENT_HOURS = 2;

export function calendarEventDetails(event: EventDetail) {
  const endDate = new Date(event.startsAt.getTime() + DEFAULT_EVENT_HOURS * 60 * 60 * 1000);
  return {
    title: event.title,
    startDate: event.startsAt,
    endDate,
    location: `${event.venue}, ${event.address}`,
    notes: `${event.description}\n\nAdded from yard.`,
  };
}

export type CalendarResult = 'saved' | 'canceled' | 'unavailable' | 'error';

/**
 * Opens the system "new event" screen, pre-filled. It runs in its own process, so we never read
 * the calendar and iOS needs no permission prompt. On web or if it fails we say so.
 */
export async function addToCalendar(event: EventDetail): Promise<CalendarResult> {
  if (process.env.EXPO_OS === 'web') return 'unavailable';
  try {
    // Loaded on demand so web and tests never touch the native module.
    const Calendar = await import('expo-calendar');
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
  } else if (result === 'error') {
    Alert.alert(
      "Couldn't open your calendar",
      'If you turned off calendar access for yard, you can allow it in Settings. Then try again.',
    );
  }
}
