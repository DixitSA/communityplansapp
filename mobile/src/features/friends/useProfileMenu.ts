import { useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';

import { api, errorCode, mapChatError, type PersonSummary, type ReportReason } from '@/lib/api';
import { warning } from '@/lib/haptics';
import { showMenu } from '@/lib/menu';

import { invalidateBlockSensitiveQueries } from './blockCache';

const REASONS: { reason: ReportReason; label: string }[] = [
  { reason: 'spam', label: 'Spam' },
  { reason: 'harassment', label: 'Harassment' },
  { reason: 'other', label: 'Something else' },
];

const failed = (err: unknown) => Alert.alert('That didn’t work', mapChatError(errorCode(err)));

/**
 * The ··· menu on someone's profile: Report and Block (App Store guideline 1.2). Blocking removes any
 * friendship on the server, so every block-sensitive view refetches and `onBlocked` leaves the page.
 */
export function useProfileMenu(person: PersonSummary | null, onBlocked: () => void) {
  const client = useQueryClient();
  return () => {
    if (!person) return;
    const report = () =>
      showMenu(
        'Why are you reporting this person?',
        REASONS.map(({ reason, label }) => ({
          label,
          run: () => {
            api
              .reportUser(person.id, reason)
              .then(() => Alert.alert('Thanks for telling us', 'We’ll review this report.'))
              .catch(failed);
          },
        })),
      );
    const block = () => {
      warning();
      Alert.alert(`Block ${person.displayName}?`, 'You won’t see each other anywhere in yard, and any friendship ends.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: () => {
            api
              .blockUser(person.id)
              .then(() => {
                invalidateBlockSensitiveQueries(client);
                onBlocked();
              })
              .catch(failed);
          },
        },
      ]);
    };
    showMenu(person.displayName, [
      { label: 'Report', destructive: true, run: report },
      { label: `Block ${person.displayName}`, destructive: true, run: block },
    ]);
  };
}
