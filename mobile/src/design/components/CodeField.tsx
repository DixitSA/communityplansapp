import { useEffect, useRef, type ComponentRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../theme';
import { AppText } from './AppText';

export type CodeFieldProps = {
  value: string;
  onChangeText: (value: string) => void;
  /** Called once, as soon as the last digit is typed or pasted. */
  onComplete?: (code: string) => void;
  length?: number;
  /** Draws danger rings and shakes once (not under Reduce Motion). */
  error?: boolean;
  editable?: boolean;
  autoFocus?: boolean;
};

/** One-time-code input: six boxes over a single hidden field, so paste and iOS code autofill just work. */
export function CodeField({
  value,
  onChangeText,
  onComplete,
  length = 6,
  error = false,
  editable = true,
  autoFocus = true,
}: CodeFieldProps) {
  const { colors, space, radius } = useTheme();
  const reduceMotion = useReducedMotion();
  const inputRef = useRef<ComponentRef<typeof TextInput>>(null);
  const shift = useSharedValue(0);

  useEffect(() => {
    if (!error || reduceMotion) return;
    shift.value = withSequence(
      withTiming(-8, { duration: 50 }),
      withTiming(8, { duration: 80 }),
      withTiming(-6, { duration: 80 }),
      withTiming(0, { duration: 50 }),
    );
  }, [error, reduceMotion, shift]);
  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: shift.value }] }));

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, length);
    onChangeText(digits);
    if (digits.length === length && digits !== value) onComplete?.(digits);
  };

  return (
    <Pressable onPress={() => inputRef.current?.focus()} accessible={false}>
      <Animated.View style={[{ flexDirection: 'row', gap: space.sm }, shake]}>
        {Array.from({ length }, (_, i) => {
          const char = value[i];
          const active = editable && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{
                flex: 1,
                height: 60,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: radius.card,
                borderCurve: 'continuous',
                backgroundColor: colors.surface,
                borderWidth: 2,
                borderColor: error ? colors.danger : active ? colors.accent : 'transparent',
              }}
            >
              <AppText variant="title" rounded allowFontScaling={false}>
                {char ?? ''}
              </AppText>
            </View>
          );
        })}
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={handleChange}
          editable={editable}
          autoFocus={autoFocus}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={length}
          caretHidden
          accessibilityLabel={`${length}-digit code`}
          // Invisible but still on screen, so VoiceOver can find it and iOS can offer the emailed code.
          selectionColor="transparent"
          style={[StyleSheet.absoluteFill, { color: 'transparent', backgroundColor: 'transparent', outlineWidth: 0, outlineStyle: 'solid', outlineColor: 'transparent' }]}
        />
      </Animated.View>
    </Pressable>
  );
}
