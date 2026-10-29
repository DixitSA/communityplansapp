import type { FriendButtonAction } from '@/design';
import type { Friendship, PersonSummary } from '@/lib/api';

import { confirmCancelRequest, openFriendsMenu } from './confirm';
import { useFriendAction, type FriendVars } from './useFriendAction';

/**
 * Turns a FriendButton tap into the right thing: add and accept/decline run at once; cancelling a
 * request and unfriending ask first. One handler serves every list and the profile.
 */
export function useFriendButton(onError?: (err: unknown, vars: FriendVars) => void) {
  const { run, busyId } = useFriendAction(onError);
  const onAction = (person: PersonSummary, from: Friendship, action: FriendButtonAction) => {
    switch (action) {
      case 'add':
        return run({ action: 'send', person, from });
      case 'accept':
        return run({ action: 'accept', person, from });
      case 'decline':
        return run({ action: 'decline', person, from });
      case 'cancel':
        return confirmCancelRequest(person.displayName, () => run({ action: 'remove', person, from }));
      case 'friends':
        return openFriendsMenu(person.displayName, () => run({ action: 'remove', person, from }));
    }
  };
  return { onAction, busyId };
}
