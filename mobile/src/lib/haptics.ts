import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

// Thin wrapper so screens never import expo-haptics directly. No-ops on web.
function run(fn: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  fn().catch(() => {
    // Haptics are a nicety; never let them crash the app.
  });
}

/** Date or chip selection. */
export const selection = () => run(() => Haptics.selectionAsync());
/** Heart / save. */
export const light = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
/** Going, friend accepted. */
export const success = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
/** Block / report confirm. */
export const warning = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
