import { useEffect } from 'react';
import { AccessibilityInfo, Pressable, View } from 'react-native';
import Animated, { Easing, FadeIn, FadeOut, SlideInDown, SlideOutDown, useReducedMotion } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../theme';
import { AppText } from './AppText';

export type UndoToastProps = {
  message: string;
  onUndo: () => void;
  /** Called when the toast times out. */
  onDismiss: () => void;
  /** Auto-hide delay in ms. */
  duration?: number;
  /** Distance above the bottom safe area, to clear the tab bar or RSVP bar. */
  bottomOffset?: number;
};

const MIN_TARGET = 44;
const DEFAULT_OFFSET = 96;

/** A pill with a message and an Undo button. Announces itself to VoiceOver and hides after a few seconds. */
export function UndoToast({ message, onUndo, onDismiss, duration = 5000, bottomOffset = DEFAULT_OFFSET }: UndoToastProps) {
  const { colors, space, radius, shadow } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(message);
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [message, duration, onDismiss]);

  // Reduce Motion: opacity only, no slide.
  const enter = reduceMotion ? FadeIn.duration(150) : SlideInDown.duration(250).easing(Easing.out(Easing.cubic));
  const exit = reduceMotion ? FadeOut.duration(150) : SlideOutDown.duration(200);

  return (
    <Animated.View
      entering={enter}
      exiting={exit}
      accessibilityLiveRegion="polite"
      style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: insets.bottom + bottomOffset }}
    >
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: colors.deep,
            borderRadius: radius.pill,
            paddingLeft: space.lg,
            paddingRight: space.xs,
            minHeight: MIN_TARGET + space.sm,
          },
          shadow,
        ]}
      >
        <AppText variant="subheadline" color="onAccent" style={{ flex: 1, paddingVertical: space.sm }}>
          {message}
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Undo"
          onPress={onUndo}
          style={{ minHeight: MIN_TARGET, minWidth: MIN_TARGET, justifyContent: 'center', paddingHorizontal: space.md }}
        >
          <AppText variant="headline" color="onAccent" style={{ textDecorationLine: 'underline' }}>
            Undo
          </AppText>
        </Pressable>
      </View>
    </Animated.View>
  );
}
