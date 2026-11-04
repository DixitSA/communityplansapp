import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';

import { AppText, useTheme, type ColorToken } from '@/design';

type Spec = { angle: number; distance: number; size: number; delay: number; color: ColorToken };

const COUNT = 22;
const COLORS: ColorToken[] = ['accent', 'peach', 'hot', 'mint', 'accent'];

/** Evenly spread directions with a little variety in reach, size and timing. Pure, so it never reshuffles. */
export function burstSpecs(count: number = COUNT): Spec[] {
  return Array.from({ length: count }, (_, i) => ({
    angle: (i / count) * Math.PI * 2 + (i % 2) * 0.2,
    distance: 78 + (i % 4) * 24,
    size: 14 + (i % 4) * 5,
    delay: (i % 6) * 30,
    color: COLORS[i % COLORS.length],
  }));
}

const SPECS = burstSpecs();
const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);

function Sparkle({ spec, reduced }: { spec: Spec; reduced: boolean }) {
  const { colors } = useTheme();
  const progress = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (reduced) return;
    progress.set(withDelay(spec.delay, withTiming(1, { duration: 1000, easing: EASE_OUT })));
  }, [progress, reduced, spec.delay]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    // Under Reduce Motion the sparkles just sit around the badge, static.
    const reach = reduced ? 0.7 : p;
    return {
      opacity: reduced ? 0.8 : interpolate(p, [0, 0.15, 0.7, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: Math.cos(spec.angle) * spec.distance * reach },
        { translateY: Math.sin(spec.angle) * spec.distance * reach },
        { scale: reduced ? 1 : interpolate(p, [0, 1], [0.4, 1]) },
      ],
    };
  });

  return (
    <Animated.View style={[{ position: 'absolute' }, style]}>
      <AppText allowFontScaling={false} style={{ color: colors[spec.color], fontSize: spec.size, lineHeight: spec.size * 1.2 }}>
        ✦
      </AppText>
    </Animated.View>
  );
}

const RING = 64;

/** A soft ring that swells out from the badge and fades, a shockwave under the sparkles. */
function Shockwave({ delay }: { delay: number }) {
  const { colors } = useTheme();
  const progress = useSharedValue(0);
  useEffect(() => {
    progress.set(withDelay(delay, withTiming(1, { duration: 750, easing: EASE_OUT })));
  }, [progress, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(progress.get(), [0, 0.2, 1], [0, 0.55, 0]),
    transform: [{ scale: interpolate(progress.get(), [0, 1], [0.8, 2.6]) }],
  }));
  return (
    <Animated.View
      style={[
        { position: 'absolute', width: RING, height: RING, borderRadius: RING / 2, borderWidth: 3, borderColor: colors.accent },
        style,
      ]}
    />
  );
}

/** The ✦ particle burst from the Going moment. Draws around the center of its parent. */
export function GoingBurst() {
  const reduced = useReducedMotion();
  return (
    <View
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      {reduced ? null : (
        <>
          <Shockwave delay={0} />
          <Shockwave delay={140} />
        </>
      )}
      {SPECS.map((spec, i) => (
        <Sparkle key={i} spec={spec} reduced={reduced} />
      ))}
    </View>
  );
}
