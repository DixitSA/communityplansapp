import { Alert } from 'react-native';

import { warning } from '@/lib/haptics';
import { showMenu } from '@/lib/menu';

/** Cancelling a request you sent: asks first, because the other person has to be asked again. */
export function confirmCancelRequest(name: string, run: () => void): void {
  warning();
  Alert.alert(`Cancel your request to ${name}?`, 'You can send another one later.', [
    { text: 'Keep request', style: 'cancel' },
    { text: 'Cancel request', style: 'destructive', onPress: run },
  ]);
}

/** Unfriending: asks first. Nobody is notified, but plans shared with friends go private again. */
export function confirmRemoveFriend(name: string, run: () => void): void {
  warning();
  Alert.alert(`Remove ${name} as a friend?`, 'They won’t be told. You’ll stop seeing each other’s plans.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Remove', style: 'destructive', onPress: run },
  ]);
}

/** The menu behind the "Friends" button. */
export function openFriendsMenu(name: string, onRemove: () => void): void {
  showMenu(name, [{ label: 'Remove friend', destructive: true, run: () => confirmRemoveFriend(name, onRemove) }]);
}
