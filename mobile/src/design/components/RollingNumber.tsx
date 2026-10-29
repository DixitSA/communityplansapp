import { View } from 'react-native';
import Animated, { SlideInDown, SlideOutUp, useReducedMotion } from 'react-native-reanimated';

import { useTheme } from '../theme';
import type { ColorToken, TypeVariant } from '../tokens';
import { AppText } from './AppText';

export type RollingNumberProps = {
  value: number;
  variant?: TypeVariant;
  color?: ColorToken;
};

/**
 * A number that rolls up when it changes (DESIGN.md §4.8). Reanimated's "entering" and "exiting"
 * animations run when React sees a new `key`. With Reduce Motion on, the number just swaps.
 */
export function RollingNumber({ value, variant = 'headline', color = 'ink' }: RollingNumberProps) {
  const { type } = useTheme();
  const reduceMotion = useReducedMotion();
  return (
    <View
      accessible
      accessibilityLabel={String(value)}
      style={{ height: type[variant].lineHeight, overflow: 'hidden', justifyContent: 'center' }}
    >
      {/* Invisible copy that gives the container its width while the real number is absolutely positioned. */}
      <AppText variant={variant} rounded style={{ opacity: 0 }} accessibilityElementsHidden importantForAccessibility="no">
        {value}
      </AppText>
      <Animated.View
        key={value}
        entering={reduceMotion ? undefined : SlideInDown.duration(220)}
        exiting={reduceMotion ? undefined : SlideOutUp.duration(220)}
        style={{ position: 'absolute', left: 0, right: 0 }}
      >
        <AppText variant={variant} color={color} rounded style={{ textAlign: 'center' }}>
          {value}
        </AppText>
      </Animated.View>
    </View>
  );
}
