import { Share } from 'react-native';

export const INVITE_MESSAGE = 'I’m using yard to find events in Charlotte and see who’s going. Come find your people with me.';

/** Opens the system share sheet with the app invite. */
export function inviteFriends(): void {
  Share.share({ message: INVITE_MESSAGE }).catch(() => {
    // Closing the share sheet can reject on some platforms; nothing to do.
  });
}
