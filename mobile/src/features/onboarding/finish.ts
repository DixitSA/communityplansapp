import type { OnboardingInput } from '@/lib/api';
import {
  MIN_INTERESTS,
  isAtLeast18,
  isValidDisplayName,
  isValidUsername,
  parseDateOnly,
} from '@/lib/validation';

import type { OnboardingDraft } from './draftStore';

export type FinishResult =
  | { ok: true; input: OnboardingInput }
  | { ok: false; step: 'profile' | 'interests' };

/**
 * Turns the draft into the RPC input, or says which step is incomplete (someone who deep-linked
 * to the last screen, or demo mode where every screen is open).
 */
export function draftToInput(draft: OnboardingDraft, today: Date = new Date()): FinishResult {
  const birthdate = draft.birthdate ? parseDateOnly(draft.birthdate) : null;
  if (
    !isValidDisplayName(draft.displayName) ||
    !isValidUsername(draft.username) ||
    !birthdate ||
    !isAtLeast18(birthdate, today)
  ) {
    return { ok: false, step: 'profile' };
  }
  if (draft.interestIds.length < MIN_INTERESTS) return { ok: false, step: 'interests' };
  return {
    ok: true,
    input: {
      username: draft.username,
      displayName: draft.displayName.trim(),
      birthdate: draft.birthdate as string,
      interestIds: draft.interestIds,
      homeCityId: draft.homeCityId,
    },
  };
}
