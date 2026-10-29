import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GlassSurface, Icon, useTheme } from '@/design';
import { CHAT_MAX_LENGTH } from '@/lib/api';
import { light } from '@/lib/haptics';

import type { SendFailure } from './useChat';
import { useKeyboardVisible } from './useKeyboardVisible';

/** Show the character counter only when the limit is getting close. */
const COUNTER_FROM = CHAT_MAX_LENGTH - 200;
/** Height of the field and the send button (a comfortable touch target). */
const CONTROL = 40;

export type ComposerProps = {
  /** Returns false when nothing was sent (empty text). */
  onSend: (text: string) => boolean;
  failure: SendFailure | null;
  onDismissFailure: () => void;
};

/** The message box: a growing text field and a round send button on a glass bar. */
export function Composer({ onSend, failure, onDismissFailure }: ComposerProps) {
  const { colors, space, radius, type } = useTheme();
  const insets = useSafeAreaInsets();
  const keyboardVisible = useKeyboardVisible();
  const [text, setText] = useState('');
  const canSend = text.trim().length > 0;

  // A send that failed gives the text back, unless the person already started something new.
  // (Adjusting state while rendering, React's pattern for reacting to a changed prop.)
  const [seenFailure, setSeenFailure] = useState<SendFailure | null>(null);
  if (failure !== seenFailure) {
    setSeenFailure(failure);
    if (failure && text === '') setText(failure.body);
  }

  const send = () => {
    if (!canSend) return;
    light();
    if (onSend(text)) setText('');
  };

  return (
    <GlassSurface
      style={{
        paddingHorizontal: space.lg,
        paddingTop: space.sm,
        paddingBottom: keyboardVisible ? space.sm : Math.max(insets.bottom, space.sm),
        gap: space.xs,
      }}
    >
      {failure ? (
        <Pressable
          onPress={onDismissFailure}
          accessibilityRole="alert"
          accessibilityLabel={failure.message}
          accessibilityHint="Double tap to dismiss"
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}
        >
          <Icon name="exclamationmark.circle.fill" size={14} color="danger" />
          <AppText variant="footnote" color="danger" style={{ flexShrink: 1 }}>
            {failure.message}
          </AppText>
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space.sm }}>
        <TextInput
          value={text}
          onChangeText={(next) => {
            setText(next);
            if (failure) onDismissFailure();
          }}
          placeholder="Message the group"
          placeholderTextColor={colors.inkSecondary}
          multiline
          numberOfLines={1}
          maxLength={CHAT_MAX_LENGTH}
          accessibilityLabel="Message"
          accessibilityHint="Type a message to the group"
          allowFontScaling
          maxFontSizeMultiplier={1.4}
          selectionColor={colors.accent}
          style={{
            flex: 1,
            minHeight: CONTROL,
            maxHeight: 120,
            paddingHorizontal: space.lg,
            paddingTop: space.sm + 1,
            paddingBottom: space.sm + 1,
            borderRadius: radius.sheet,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.surface,
            color: colors.ink,
            fontSize: type.body.fontSize,
            lineHeight: type.body.lineHeight,
          }}
        />
        <Pressable
          onPress={send}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel="Send message"
          accessibilityState={{ disabled: !canSend }}
          style={({ pressed }) => [
            {
              width: CONTROL,
              height: CONTROL,
              borderRadius: radius.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: canSend ? colors.accent : colors.surfaceMuted,
            },
            pressed && { opacity: 0.8, transform: [{ scale: 0.95 }] },
          ]}
        >
          <Icon name="arrow.up" size={18} color={canSend ? 'onAccent' : 'inkSecondary'} weight="bold" />
        </Pressable>
      </View>
      {text.length >= COUNTER_FROM ? (
        <AppText variant="caption" color="inkSecondary" style={{ textAlign: 'right' }} rounded>
          {text.length} / {CHAT_MAX_LENGTH}
        </AppText>
      ) : null}
    </GlassSurface>
  );
}
