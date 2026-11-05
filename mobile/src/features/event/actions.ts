import { ActionSheetIOS, Alert, Linking, Share } from 'react-native';

import { api, errorCode, mapChatError, type EventReportReason } from '@/lib/api';
import { formatShortDate, formatTime } from '@/lib/dates';
import { appStoreUrl } from '@/lib/env';
import { warning } from '@/lib/haptics';
import { showMenu } from '@/lib/menu';

import type { EventDetail } from './types';

type Shareable = Pick<EventDetail, 'title' | 'startsAt' | 'venue'>;

/** Text for the system share sheet. "invite" is what you send a friend after tapping Going. */
export function shareMessage(event: Shareable, kind: 'share' | 'invite', storeUrl: string | null = appStoreUrl): string {
  const when = `${formatShortDate(event.startsAt)} at ${formatTime(event.startsAt)}`;
  const text =
    kind === 'invite'
      ? `I'm going to ${event.title} on ${when} at ${event.venue}. Come with me?`
      : `${event.title}, ${when} at ${event.venue}. Found on yard.`;
  // The link goes in the text (not Share's iOS-only `url`) so Messages, WhatsApp and Android all get it.
  return storeUrl ? `${text}\n\nGet yard: ${storeUrl}` : text;
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

/** Opens the event's ticket or source listing and explains if the system cannot open it. */
export async function openEventListing(url: string): Promise<void> {
  try {
    await Linking.openURL(url);
  } catch {
    Alert.alert("Couldn't open this listing", 'Try again in a moment.');
  }
}

const REPORT_REASONS: { reason: EventReportReason; label: string }[] = [
  { reason: 'wrong_details', label: 'Wrong details' },
  { reason: 'spam_or_scam', label: 'Spam or scam' },
  { reason: 'unsafe', label: 'Unsafe or inappropriate' },
  { reason: 'other', label: 'Something else' },
];

/** Reason picker, then the report goes to the backend (App Store guideline 1.2). */
function reportEvent(eventId: string): void {
  warning();
  showMenu(
    'Why are you reporting this event?',
    REPORT_REASONS.map(({ reason, label }) => ({
      label,
      run: () => {
        api
          .reportEvent(eventId, reason)
          .then(() => Alert.alert('Thanks for telling us', 'We’ll review this report.'))
          .catch((err: unknown) => Alert.alert('That didn’t work', mapChatError(errorCode(err))));
      },
    })),
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
        if (index === 1) reportEvent(event.id);
      },
    );
    return;
  }
  Alert.alert(event.title, undefined, [
    { text: 'Get directions', onPress: () => openDirections(event) },
    { text: 'Report', style: 'destructive', onPress: () => reportEvent(event.id) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}
