import { useEffect, type ReactNode } from 'react';
import { View } from 'react-native';
import Animated, {
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';
import { motion } from '../tokens';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

export type EmptyStateProps = {
  symbol: SymbolName;
  title: string;
  message: string;
  /** Optional action under the message, e.g. a "Clear filters" button. */
  children?: ReactNode;
};

const BADGE = 72;

/**
 * Empty, error and "nothing yet" screens. The badge pops in on a spring with a little wobble, then
 * the text rises in behind it. Under Reduce Motion everything is simply there.
 */
export function EmptyState({ symbol, title, message, children }: EmptyStateProps) {
  const { colors, space, radius } = useTheme();
  const reduced = useReducedMotion();
  const pop = useSharedValue(reduced ? 1 : 0);
  const tilt = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    pop.set(withSpring(1, motion.popSpring));
    tilt.set(withDelay(120, withSequence(withTiming(-10, { duration: 110 }), withSpring(0, { damping: 6, stiffness: 160 }))));
  }, [reduced, pop, tilt]);

  const badge = useAnimatedStyle(() => ({
    opacity: Math.min(pop.get() * 2, 1),
    transform: [{ scale: 0.4 + 0.6 * pop.get() }, { rotate: `${tilt.get()}deg` }],
  }));

  const rise = (delay: number) =>
    reduced ? undefined : FadeInDown.delay(delay).springify().damping(18).reduceMotion(ReduceMotion.System);

  return (
    <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xxxl, paddingHorizontal: space.xl }}>
      <Animated.View
        style={[
          {
            width: BADGE,
            height: BADGE,
            borderRadius: radius.pill,
            borderCurve: 'continuous',
            backgroundColor: colors.accentSoft,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: space.sm,
          },
          badge,
        ]}
      >
        <Icon name={symbol} size={32} color="accent" weight="semibold" />
      </Animated.View>
      <Animated.View entering={rise(120)}>
        <AppText variant="title2" style={{ textAlign: 'center', fontWeight: '800' }}>
          {title}
        </AppText>
      </Animated.View>
      <Animated.View entering={rise(200)}>
        <AppText variant="subheadline" color="inkSecondary" style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      </Animated.View>
      {children ? <Animated.View entering={rise(280)} style={{ alignSelf: 'stretch', alignItems: 'center' }}>{children}</Animated.View> : null}
    </View>
  );
}
