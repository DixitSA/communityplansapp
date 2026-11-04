import { kv } from '@/lib/kv';
import { useCallback } from 'react';
import { Alert } from 'react-native';

const KEY_PREFIX = 'hint_seen_';

const COPY = {
  down_if_friends: {
    title: 'Down if friends go',
    body: "We'll ping you the moment a friend taps Going. Until then, only you can see this.",
  },
} as const;

export type HintId = keyof typeof COPY;

/** Shows the hint's alert the first time it is called on this install, then never again. */
export async function showHintOnce(id: HintId): Promise<void> {
  try {
    const key = KEY_PREFIX + id;
    if ((await kv.getItem(key)) != null) return;
    await kv.setItem(key, '1');
    Alert.alert(COPY[id].title, COPY[id].body, [{ text: 'Got it', style: 'default' }]);
  } catch {
    // A hint is never worth breaking the action it explains.
  }
}

/** Returns a function that shows a one-time explainer (a native alert), persisted on the device. */
export function useFirstTimeHint(id: HintId) {
  return useCallback(() => showHintOnce(id), [id]);
}
