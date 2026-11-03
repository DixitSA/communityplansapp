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

import { EventArt, Facepile, MeshBackground, buildMesh, useTheme } from '@/design';

const CARDS = [
  { id: 'welcome-music', interest: 'music', symbol: 'music.note', rotate: '-9deg', x: -64, y: 14 },
  { id: 'welcome-nightlife', interest: 'nightlife', symbol: 'moon.stars.fill', rotate: '8deg', x: 64, y: 22 },
  { id: 'welcome-food', interest: 'food_drinks', symbol: 'fork.knife', rotate: '-1deg', x: 0, y: -8 },
] as const;

const FACES = [
  { id: 'w1', name: 'Maya Chen' },
  { id: 'w2', name: 'Jordan Lee' },
  { id: 'w3', name: 'Sam Patel' },
];

/**
 * Welcome art: a soft turning blob behind a fan of three tilted event cards and a facepile, so it reads as
 * events + people. Still (no turning, no float) under Reduce Motion.
 */
export function WelcomeBlob({ size = 240 }: { size?: number }) {
  const { colors, radius, space, shadow } = useTheme();
  const reduceMotion = useReducedMotion();
  const turn = useSharedValue(0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    turn.value = withRepeat(withTiming(360, { duration: 30000, easing: Easing.linear }), -1, false);
    float.value = withRepeat(withTiming(1, { duration: 3200, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduceMotion, turn, float]);

  const clockwise = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }));
  const counter = useAnimatedStyle(() => ({ transform: [{ rotate: `${-turn.value * 1.6}deg` }] }));

  const bob = useAnimatedStyle(() => ({ transform: [{ translateY: -6 * float.value }] }));

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
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center', marginBottom: space.lg }}
    >
      <Animated.View style={[blob(size), clockwise]}>
        <MeshBackground colors={outer.colors} points={outer.points} />
      </Animated.View>
      <Animated.View style={[blob(innerSize), counter, { position: 'absolute', opacity: 0.85 }]}>
        <MeshBackground colors={inner.colors} points={inner.points} />
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', width: size, height: size * 0.7, alignItems: 'center', justifyContent: 'center' }, bob]}>
        {CARDS.map((c) => (
          <View
            key={c.id}
            style={[
              {
                position: 'absolute',
                width: size * 0.4,
                height: size * 0.54,
                borderRadius: radius.card,
                borderCurve: 'continuous',
                overflow: 'hidden',
                borderWidth: 3,
                borderColor: colors.canvas,
                backgroundColor: colors.canvas,
                transform: [{ translateX: c.x * (size / 240) }, { translateY: c.y }, { rotate: c.rotate }],
              },
              shadow,
            ]}
          >
            <EventArt event={{ id: c.id, interest: c.interest, symbol: c.symbol }} symbolSize={size * 0.12} />
          </View>
        ))}
      </Animated.View>
      <View style={{ position: 'absolute', bottom: -space.lg }}>
        <Facepile people={FACES} total={FACES.length} avatarSize={32} />
      </View>
    </View>
  );
}
