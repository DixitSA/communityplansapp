import { ActionSheetIOS, Alert, Linking, Share } from 'react-native';

import { formatShortDate, formatTime } from '@/lib/dates';
import { warning } from '@/lib/haptics';

import type { EventDetail } from './types';

type Shareable = Pick<EventDetail, 'title' | 'startsAt' | 'venue'>;

/** Text for the system share sheet. "invite" is what you send a friend after tapping Going. */
export function shareMessage(event: Shareable, kind: 'share' | 'invite'): string {
  const when = `${formatShortDate(event.startsAt)} at ${formatTime(event.startsAt)}`;
  return kind === 'invite'
    ? `I'm going to ${event.title} on ${when} at ${event.venue}. Come with me?`
    : `${event.title}, ${when} at ${event.venue}. Found on yard.`;
}

export async function shareEvent(event: Shareable, kind: 'share' | 'invite'): Promise<void> {
  try {
    await Share.share({ message: shareMessage(event, kind) });
  } catch {
    // The user can always try again; a failed share sheet isn't worth an error screen.
  }
}

/** Apple Maps search link. Only the venue text goes in the URL, never the user's location. */
export function directionsUrl(event: Pick<EventDetail, 'venue' | 'address'>): string {
  return `https://maps.apple.com/?q=${encodeURIComponent(`${event.venue}, ${event.address}`)}`;
}

export function openDirections(event: Pick<EventDetail, 'venue' | 'address'>): void {
  Linking.openURL(directionsUrl(event)).catch(() => {
    Alert.alert("Couldn't open Maps", 'Try again in a moment.');
  });
}

/** Placeholder until reporting is wired to the backend (App Store guideline 1.2 needs the entry point). */
function reportPlaceholder(): void {
  warning();
  Alert.alert(
    'Report this event',
    "Reporting isn't connected yet. Soon you'll be able to flag events that look wrong or unsafe.",
  );
}

/** The ··· menu on the event page: a native action sheet on iOS, an alert elsewhere. */
export function openEventMenu(event: EventDetail): void {
  if (process.env.EXPO_OS === 'ios') {
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: event.title,
        options: ['Get directions', 'Report', 'Cancel'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (index) => {
        if (index === 0) openDirections(event);
        if (index === 1) reportPlaceholder();
      },
    );
    return;
  }
  Alert.alert(event.title, undefined, [
    { text: 'Get directions', onPress: () => openDirections(event) },
    { text: 'Report', style: 'destructive', onPress: reportPlaceholder },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
