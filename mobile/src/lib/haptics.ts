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
/** Impact weights for the Going moment (see `celebrate`). */
const medium = () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));

/**
 * The Going moment: success, then two quick taps that land with the sparkle burst, like a little drumroll.
 * Only for committing to a plan (DESIGN.md 4.5), never for browsing.
 */
export function celebrate() {
  success();
  setTimeout(medium, 130);
  setTimeout(() => light(), 260);
}
/** Block / report confirm. */
export const warning = () =>
  run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
