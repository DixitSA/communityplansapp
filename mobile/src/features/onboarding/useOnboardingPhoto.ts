import { useRef, useState } from 'react';

import { pickProfilePhoto } from '../profile/useMyAvatar';
import { useOnboardingDraft } from './draftStore';

/** Choosing a photo only changes the in-memory draft; finishing onboarding uploads it. */
export function useOnboardingPhoto() {
  const [isPicking, setIsPicking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const picking = useRef(false);

  const choosePhoto = async () => {
    if (picking.current) return;
    picking.current = true;
    setIsPicking(true);
    setProblem(null);
    const revision = useOnboardingDraft.getState().revision;
    try {
      const uri = await pickProfilePhoto();
      if (uri && useOnboardingDraft.getState().revision === revision) {
        useOnboardingDraft.getState().setPhotoUri(uri);
      }
    } catch {
      if (useOnboardingDraft.getState().revision === revision) {
        setProblem('Couldn’t open your photos. Try again, or continue without a photo.');
      }
    } finally {
      picking.current = false;
      setIsPicking(false);
    }
  };

  const removePhoto = () => {
    useOnboardingDraft.getState().setPhotoUri(null);
    setProblem(null);
  };

  return { choosePhoto, removePhoto, isPicking, problem };
}
