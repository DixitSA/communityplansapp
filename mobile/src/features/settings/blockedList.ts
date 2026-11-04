import type { BlockedPerson } from '@/lib/api';

/** The blocked list with one person taken out (used for the instant update after Unblock). */
export function withoutBlocked(list: BlockedPerson[], userId: string): BlockedPerson[] {
  return list.filter((p) => p.id !== userId);
}

/** What the delete-account alert tells people will go away. Kept in one place so the copy stays honest. */
export const DELETE_ACCOUNT_DETAILS =
  'This permanently deletes your profile, plans, friends, chat messages and photo. It can’t be undone.';
