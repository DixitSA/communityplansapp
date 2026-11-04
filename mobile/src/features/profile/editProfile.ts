import type { EditProfileInput, MyProfile } from '@/lib/api';
import { MIN_INTERESTS, isValidDisplayName, isValidUsername } from '@/lib/validation';

export const BIO_MAX = 160;

/** What the form holds while editing. */
export type EditProfileDraft = { displayName: string; username: string; bio: string; interestIds: number[] };

export function draftFromProfile(me: MyProfile): EditProfileDraft {
  return {
    displayName: me.displayName,
    username: me.username,
    bio: me.bio ?? '',
    interestIds: me.interests.map((i) => i.id),
  };
}

/** True when the draft differs from what is saved (trimmed text, interests as a set). */
export function isChanged(draft: EditProfileDraft, me: MyProfile): boolean {
  const saved = draftFromProfile(me);
  const same = (a: number[], b: number[]) => a.length === b.length && a.every((x) => b.includes(x));
  return (
    draft.displayName.trim() !== saved.displayName ||
    draft.username !== saved.username ||
    draft.bio.trim() !== saved.bio.trim() ||
    !same(draft.interestIds, saved.interestIds)
  );
}

/** Mirrors the server's checks (username availability is checked separately). */
export function isDraftValid(draft: EditProfileDraft): boolean {
  return (
    isValidDisplayName(draft.displayName) &&
    isValidUsername(draft.username) &&
    draft.bio.trim().length <= BIO_MAX &&
    draft.interestIds.length >= MIN_INTERESTS
  );
}

export function toInput(draft: EditProfileDraft): EditProfileInput {
  return {
    displayName: draft.displayName.trim(),
    username: draft.username,
    bio: draft.bio.trim(),
    interestIds: draft.interestIds,
  };
}
