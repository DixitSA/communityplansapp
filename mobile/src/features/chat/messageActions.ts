import { Alert } from 'react-native';

import { errorCode, mapChatError, type ChatMessage, type ReportReason } from '@/lib/api';
import { chatService } from '@/lib/chat';
import { warning } from '@/lib/haptics';
import { showMenu } from '@/lib/menu';

const REASONS: { reason: ReportReason; label: string }[] = [
  { reason: 'spam', label: 'Spam' },
  { reason: 'harassment', label: 'Harassment' },
  { reason: 'other', label: 'Something else' },
];

const failed = (err: unknown) => Alert.alert('That didn’t work', mapChatError(errorCode(err)));

function confirmDelete(onDelete: () => Promise<unknown>) {
  warning();
  Alert.alert('Delete this message?', 'It will show as “Message deleted” for everyone in the chat.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: () => void onDelete().catch(failed) },
  ]);
}

function pickReason(message: ChatMessage) {
  const file = (reason: ReportReason) =>
    message.deleted ? chatService.reportUser(message.userId, reason) : chatService.reportMessage(message.id, reason);
  showMenu(
    'Why are you reporting this?',
    REASONS.map(({ reason, label }) => ({
      label,
      run: () => {
        file(reason)
          .then(() => Alert.alert('Thanks for telling us', 'We’ll review this report.'))
          .catch(failed);
      },
    })),
  );
}

function confirmBlock(message: ChatMessage, onBlocked: () => void) {
  warning();
  Alert.alert(
    `Block ${message.displayName}?`,
    'You won’t see each other’s messages in any chat, and they won’t see yours.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Block',
        style: 'destructive',
        onPress: () => {
          chatService.blockUser(message.userId).then(onBlocked).catch(failed);
        },
      },
    ],
  );
}

/** Long-press on a message. Yours can be deleted; other people's can be reported or their author blocked (App Store guideline 1.2). */
export function openMessageMenu(
  message: ChatMessage,
  actions: { onDelete: (id: string) => Promise<unknown>; onBlocked: () => void },
): void {
  if (message.sending) return;
  if (message.deleted && message.isMine) return;
  if (message.isMine) {
    showMenu(undefined, [{ label: 'Delete message', destructive: true, run: () => confirmDelete(() => actions.onDelete(message.id)) }]);
    return;
  }
  showMenu(message.displayName, [
    { label: message.deleted ? 'Report user' : 'Report message', destructive: true, run: () => pickReason(message) },
    { label: `Block ${message.displayName}`, destructive: true, run: () => confirmBlock(message, actions.onBlocked) },
  ]);
}
