import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { AppText, MeshBackground, buildMesh, useTheme } from '@/design';

/** Slowly turning gradient blob with the ✦ brand mark. Still under Reduce Motion. */
export function WelcomeBlob({ size = 240 }: { size?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withRepeat(withTiming(360, { duration: 30000, easing: Easing.linear }), -1, false);
  }, [reduceMotion, turn]);

  const clockwise = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const counter = useAnimatedStyle(() => ({ transform: [{ rotate: `${-turn.value * 1.6}deg` }] }));

  const outer = buildMesh('yard-welcome-outer', [colors.mint, colors.accent, colors.peach, colors.mint, colors.accent]);
  const inner = buildMesh('yard-welcome-inner', [colors.accent, colors.peach, colors.mint, colors.peachSoft]);
  const innerSize = size * 0.66;

  // Uneven corner radii make the squircle read as a soft blob as it turns.
  const blob = (s: number) => ({
    width: s,
    height: s,
    overflow: 'hidden' as const,
    borderTopLeftRadius: s * 0.5,
    borderTopRightRadius: s * 0.42,
    borderBottomRightRadius: s * 0.5,
    borderBottomLeftRadius: s * 0.4,
    borderCurve: 'continuous' as const,
  });

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Animated.View style={[blob(size), clockwise]}>
        <MeshBackground colors={outer.colors} points={outer.points} />
      </Animated.View>
      <Animated.View style={[blob(innerSize), counter, { position: 'absolute', opacity: 0.85 }]}>
        <MeshBackground colors={inner.colors} points={inner.points} />
      </Animated.View>
      <AppText
        color="onImage"
        allowFontScaling={false}
        style={{ position: 'absolute', fontSize: size * 0.3, lineHeight: size * 0.36, fontWeight: '300' }}
      >
        ✦
      </AppText>
    </View>
  );
}
