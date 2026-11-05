import { api, errorCode, type OnboardingInput } from '@/lib/api';
import {
  MIN_INTERESTS,
  isAtLeast18,
  isValidDisplayName,
  isValidUsername,
  parseDateOnly,
} from '@/lib/validation';

import { useOnboardingDraft, type OnboardingDraft } from './draftStore';

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

export type SubmissionResult =
  | { kind: 'success' | 'cancelled' | 'photo-error' }
  | { kind: 'incomplete'; step: 'profile' | 'interests' }
  | { kind: 'error'; code: string };

/** Save the profile, then its optional photo, then refresh before releasing the routing guard. */
export async function finishOnboarding(refreshProfile: () => Promise<unknown>, skipPhoto = false, expectedUserId?: string): Promise<SubmissionResult> {
  const draft = useOnboardingDraft.getState();
  if (draft.submissionBusy) return { kind: 'cancelled' };
  const result = draftToInput(draft);
  if (!draft.profileCreated && !result.ok) return { kind: 'incomplete', step: result.step };
  const current = () => useOnboardingDraft.getState().revision === draft.revision;
  useOnboardingDraft.setState({ submissionBusy: true, completionPending: true });
  try {
    if (!draft.profileCreated && result.ok) {
      try {
        await api.completeOnboarding(result.input);
      } catch (err) {
        // The first response may have been lost after the server committed. Resume the photo step.
        if (errorCode(err) !== 'already_onboarded') throw err;
      }
      if (!current()) return { kind: 'cancelled' };
      useOnboardingDraft.setState({ profileCreated: true });
    }
    if (draft.photoUri && !skipPhoto) {
      try {
        await api.setMyAvatar(draft.photoUri, expectedUserId);
      } catch {
        return current() ? { kind: 'photo-error' } : { kind: 'cancelled' };
      }
      if (!current()) return { kind: 'cancelled' };
      // A refresh retry must not upload a photo that already saved successfully.
      useOnboardingDraft.getState().setPhotoUri(null);
    }
    if (skipPhoto) useOnboardingDraft.getState().setPhotoUri(null);
    await refreshProfile();
    if (!current()) return { kind: 'cancelled' };
    useOnboardingDraft.getState().reset();
    return { kind: 'success' };
  } catch (err) {
    return current() ? { kind: 'error', code: errorCode(err) } : { kind: 'cancelled' };
  } finally {
    if (current()) useOnboardingDraft.setState({ submissionBusy: false });
  }
}
