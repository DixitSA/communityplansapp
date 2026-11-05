import { create } from 'zustand';

import { CHARLOTTE_CITY_ID } from '@/lib/api';
import { toDateOnly } from '@/lib/validation';

/** What the person has entered so far. Lives only in memory until the last step submits it. */
export type OnboardingDraft = {
  displayName: string;
  /** Local picker URI; uploaded only after the profile has been created. */
  photoUri: string | null;
  username: string;
  /** Date-only, "YYYY-MM-DD". */
  birthdate: string | null;
  interestIds: number[];
  /** Where the feed is centered. Either location choice resolves to Charlotte for now. */
  homeCityId: number;
};

type DraftState = OnboardingDraft & {
  completionPending: boolean;
  profileCreated: boolean;
  submissionBusy: boolean;
  /** Changes on reset so old async work cannot modify a different person's draft. */
  revision: number;
  setPhotoUri: (uri: string | null) => void;
  setDisplayName: (v: string) => void;
  /** Prefill from Apple, but never overwrite what someone already typed. */
  prefillDisplayName: (v: string | null) => void;
  setUsername: (v: string) => void;
  setBirthdate: (d: Date | null) => void;
  toggleInterest: (id: number) => void;
  setHomeCityId: (id: number) => void;
  reset: () => void;
};

const EMPTY: OnboardingDraft = {
  displayName: '',
  photoUri: null,
  username: '',
  birthdate: null,
  interestIds: [],
  homeCityId: CHARLOTTE_CITY_ID,
};

export const useOnboardingDraft = create<DraftState>()((set) => ({
  ...EMPTY,
  completionPending: false,
  profileCreated: false,
  submissionBusy: false,
  revision: 0,
  setPhotoUri: (photoUri) => set({ photoUri }),
  setDisplayName: (displayName) => set({ displayName }),
  prefillDisplayName: (name) =>
    set((s) => (name && name.trim() && !s.displayName.trim() ? { displayName: name.trim() } : s)),
  setUsername: (username) => set({ username }),
  setBirthdate: (d) => set({ birthdate: d ? toDateOnly(d) : null }),
  toggleInterest: (id) =>
    set((s) => ({
      interestIds: s.interestIds.includes(id) ? s.interestIds.filter((i) => i !== id) : [...s.interestIds, id],
    })),
  setHomeCityId: (homeCityId) => set({ homeCityId }),
  reset: () => set((s) => ({ ...EMPTY, completionPending: false, profileCreated: false, submissionBusy: false, revision: s.revision + 1 })),
}));
