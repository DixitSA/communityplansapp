import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion } from './tokens';

/** Under Reduce Motion a press only dims the element a little; nothing moves. */
const REDUCED_PRESSED_OPACITY = 0.8;

/**
 * Springy press feedback: the element shrinks a touch while a finger is down and bounces back.
 * A shared value is a number that lives on the UI thread, so the animation never waits on React.
 *
 * Spread `handlers` onto the Pressable and put `style` on an `Animated.View` around what should shrink.
 */
export function usePressScale(scaleTo: number = motion.pressScale) {
  const reduced = useReducedMotion();
  // 0 = at rest, 1 = finger down.
  const pressed = useSharedValue(0);
  const style = useAnimatedStyle(() => {
    const p = pressed.get();
    return reduced
      ? { opacity: 1 - p * (1 - REDUCED_PRESSED_OPACITY) }
      : { transform: [{ scale: 1 - p * (1 - scaleTo) }] };
  });
  return {
    style,
    handlers: {
      onPressIn: () => pressed.set(reduced ? 1 : withSpring(1, motion.pressSpring)),
      onPressOut: () => pressed.set(reduced ? 0 : withSpring(0, motion.pressSpring)),
    },
  };
}

/**
 * The view that carries `style` from usePressScale. It's Reanimated's Animated.View, exported from here so
 * tests that can't load Reanimated (the router harness) can swap this one module for plain Views.
 */
export const PressScaleView = Animated.View;
