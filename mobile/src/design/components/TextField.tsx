import { useState, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

export type FieldStatus = {
  tone: 'neutral' | 'checking' | 'success' | 'error';
  text: string;
};

export type TextFieldProps = Omit<TextInputProps, 'style' | 'placeholderTextColor'> & {
  /** Small label above the field. Also the VoiceOver label. */
  label?: string;
  /** Fixed text before the input, e.g. "@" for usernames. */
  prefix?: string;
  /** Inline feedback under the field: availability, errors, hints. */
  status?: FieldStatus | null;
  /** Something at the end of the field, e.g. a clear button. */
  trailing?: ReactNode;
};

const STATUS_COLOR: Record<FieldStatus['tone'], ColorToken> = {
  neutral: 'inkSecondary',
  checking: 'inkSecondary',
  success: 'accent',
  error: 'danger',
};
const STATUS_ICON: Partial<Record<FieldStatus['tone'], SymbolName>> = {
  success: 'checkmark.circle.fill',
  error: 'exclamationmark.circle.fill',
};

/** The feedback line under a field: a glyph for success and error, then the text. */
export function FieldStatusLine({ status }: { status: FieldStatus }) {
  const { space } = useTheme();
  const error = status.tone === 'error';
  const icon = STATUS_ICON[status.tone];
  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole={error ? 'alert' : undefined}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.xs }}
    >
      {icon ? <Icon name={icon} size={14} color={STATUS_COLOR[status.tone]} /> : null}
      <AppText variant="footnote" color={STATUS_COLOR[status.tone]} style={{ flexShrink: 1 }}>
        {status.text}
      </AppText>
    </View>
  );
}

/** Single-line input on a surface card. Focus draws an accent ring; errors draw a danger ring. */
export function TextField({ label, prefix, status, trailing, onFocus, onBlur, ...input }: TextFieldProps) {
  const { colors, space, radius, type } = useTheme();
  const [focused, setFocused] = useState(false);
  const error = status?.tone === 'error';
  const ring = error ? colors.danger : focused ? colors.accent : 'transparent';

  return (
    <View style={{ gap: space.sm }}>
      {label ? (
        <AppText variant="footnote" color="inkSecondary" style={{ fontWeight: '500', paddingLeft: space.xs }}>
          {label}
        </AppText>
      ) : null}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 52,
          paddingHorizontal: space.lg,
          gap: space.xs,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: colors.surface,
          borderWidth: 2,
          borderColor: ring,
        }}
      >
        {prefix ? (
          <AppText variant="body" color="inkSecondary" accessibilityElementsHidden>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          {...input}
          accessibilityLabel={input.accessibilityLabel ?? label}
          accessibilityHint={status?.text ?? input.accessibilityHint}
          placeholderTextColor={colors.inkSecondary}
          selectionColor={colors.accent}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          // The ring on the wrapper is the focus indicator, so hide the browser's own outline (web only).
          style={[type.body, { flex: 1, color: colors.ink, paddingVertical: space.md, outlineWidth: 0, outlineStyle: 'solid', outlineColor: 'transparent' }]}
        />
        {trailing}
      </View>
      {status ? <FieldStatusLine status={status} /> : null}
    </View>
  );
}
