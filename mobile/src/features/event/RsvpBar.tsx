import { useEffect, useRef, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  FadeIn,
  LinearTransition,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GlassSurface, Icon, useTheme, type SymbolName } from '@/design';

import { privacyHint } from './plansLogic';
import type { PlanChoice, PlanStatus } from './plansStore';

export type RsvpBarProps = {
  status: PlanChoice;
  onChoose: (choice: Exclude<PlanStatus, 'going'>) => void;
  /** Called when Going is tapped. The page decides: confirm Going, or open the chat if already Going. */
  onGoing: () => void;
  onLayoutHeight?: (height: number) => void;
};

/** Pops the icon when a choice is made, like a symbol bounce. Still under Reduce Motion. */
function Bounce({ active, children }: { active: boolean; children: ReactNode }) {
  const scale = useSharedValue(1);
  const reduced = useReducedMotion();
  const mounted = useRef(false);
  useEffect(() => {
    // Don't bounce for a status that was already set when the page opened.
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    if (active && !reduced) {
      scale.set(withSequence(withTiming(0.8, { duration: 80 }), withSpring(1, { duration: 400, dampingRatio: 0.5 })));
    }
  }, [active, reduced, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}

type RsvpButtonProps = {
  label: string;
  /** What's drawn, when it should break differently from the spoken label. */
  displayLabel?: string;
  hint: string;
  symbol: SymbolName;
  activeSymbol: SymbolName;
  selected: boolean;
  /** The Going button: always the filled accent button. */
  primary?: boolean;
  flex: number;
  onPress: () => void;
};

function RsvpButton({ label, displayLabel, hint, symbol, activeSymbol, selected, primary = false, flex, onPress }: RsvpButtonProps) {
  const { colors, space, radius } = useTheme();
  const reduced = useReducedMotion();
  const fg = primary ? 'onAccent' : 'ink';
  return (
    <Animated.View style={{ flex }} layout={reduced ? undefined : LinearTransition.duration(250)}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint={hint}
        accessibilityState={{ selected }}
        style={({ pressed }) => [
          {
            flex: 1,
            minHeight: 68,
            alignItems: 'center',
            justifyContent: 'center',
            gap: space.xs,
            paddingHorizontal: space.sm,
            paddingVertical: space.sm,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: primary ? colors.accent : selected ? colors.accentSoft : colors.surface,
            borderWidth: primary ? 0 : StyleSheet.hairlineWidth,
            borderColor: selected ? colors.accent : colors.line,
          },
          pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
        ]}
      >
        <Bounce active={selected}>
          <Icon
            name={selected ? activeSymbol : symbol}
            size={22}
            color={primary ? 'onAccent' : selected ? 'accent' : 'ink'}
          />
        </Bounce>
        <AppText
          variant="footnote"
          color={fg}
          maxFontSizeMultiplier={1.4}
          style={{ fontWeight: '600', textAlign: 'center' }}
        >
          {displayLabel ?? label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

/** The pinned bottom row of the event page: Interested, Down if friends go, Going (DESIGN.md 4.4). */
export function RsvpBar({ status, onChoose, onGoing, onLayoutHeight }: RsvpBarProps) {
  const { space } = useTheme();
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  const hint = privacyHint(status);
  const going = status === 'going';

  return (
    <View style={styles.pinned} onLayout={(e) => onLayoutHeight?.(e.nativeEvent.layout.height)}>
      <GlassSurface
        style={{
          paddingHorizontal: space.lg,
          paddingTop: space.md,
          paddingBottom: Math.max(insets.bottom, space.md),
          gap: space.sm,
        }}
      >
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <RsvpButton
            label="Interested"
            hint="Only you can see this"
            symbol="heart"
            activeSymbol="heart.fill"
            selected={status === 'interested'}
            flex={1}
            onPress={() => onChoose('interested')}
          />
          <RsvpButton
            label="Down if friends go"
            displayLabel={'Down if\nfriends go'}
            hint="Only you can see this"
            symbol="person.2"
            activeSymbol="person.2.fill"
            selected={status === 'down_if_friends'}
            flex={1}
            onPress={() => onChoose('down_if_friends')}
          />
          <RsvpButton
            label={going ? 'Going · Open chat' : 'Going'}
            hint={going ? 'Opens the event chat' : 'Friends and other attendees can see this'}
            symbol="checkmark.circle"
            activeSymbol="checkmark.circle.fill"
            selected={going}
            primary
            flex={going ? 1.5 : 1}
            onPress={onGoing}
          />
        </View>
        {/* Space is always reserved, so the buttons don't jump when the hint appears. */}
        <View
          style={{ minHeight: 20, alignItems: 'center', justifyContent: 'center' }}
          accessibilityLiveRegion="polite"
        >
          {hint ? (
            <Animated.View
              key={hint}
              entering={reduced ? undefined : FadeIn.duration(200)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
            >
              <Icon name={going ? 'person.2.fill' : 'lock.fill'} size={12} color="inkSecondary" />
              <AppText variant="footnote" color="inkSecondary">
                {hint}
              </AppText>
            </Animated.View>
          ) : null}
        </View>
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  pinned: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
