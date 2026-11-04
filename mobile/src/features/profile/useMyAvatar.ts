import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';

import { api } from '@/lib/api';

import { MY_PROFILE_KEY } from './useMyProfile';

/**
 * Opens the photo library and returns the picked image's file URI, or null if the person cancelled.
 * The picker crops to a square and compresses a little (`quality`), so uploads stay small.
 */
export async function pickProfilePhoto(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
  });
  if (result.canceled) return null;
  return result.assets[0]?.uri ?? null;
}

/**
 * Change or remove the viewer's profile photo. Each is a TanStack Query "mutation" (a write); when one
 * succeeds we mark the profile (and event pages, which can show you in the going list) stale so they refetch.
 */
export function useMyAvatar() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [MY_PROFILE_KEY] }),
      queryClient.invalidateQueries({ queryKey: ['event'] }),
    ]);
  const change = useMutation({ mutationFn: (fileUri: string) => api.setMyAvatar(fileUri), onSuccess: refresh });
  const remove = useMutation({ mutationFn: () => api.removeMyAvatar(), onSuccess: refresh });
  return {
    change: change.mutateAsync,
    remove: remove.mutateAsync,
    isPending: change.isPending || remove.isPending,
    isError: change.isError || remove.isError,
    reset: () => {
      change.reset();
      remove.reset();
    },
  };
}
