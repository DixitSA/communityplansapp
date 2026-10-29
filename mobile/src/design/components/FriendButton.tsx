import { ActivityIndicator, Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

export type FriendButtonState = 'none' | 'outgoing' | 'incoming' | 'friends';
/** What a tap means. 'friends' opens the menu with Remove friend; 'cancel' cancels a request you sent. */
export type FriendButtonAction = 'add' | 'cancel' | 'accept' | 'decline' | 'friends';

export type FriendButtonSpec = {
  label: string;
  symbol?: SymbolName;
  trailingSymbol?: SymbolName;
  /** Filled accent is the one primary action; muted is a state you're already in. */
  tone: 'primary' | 'muted';
  action: FriendButtonAction;
};

/** The label and look of each relationship state (DESIGN.md 6, row 14: "an Add Friend button with clear states"). */
export function friendButtonSpec(state: FriendButtonState, size: 'regular' | 'compact' = 'regular'): FriendButtonSpec {
  switch (state) {
    case 'none':
      return { label: size === 'compact' ? 'Add' : 'Add friend', symbol: 'person.badge.plus', tone: 'primary', action: 'add' };
    case 'outgoing':
      return { label: 'Requested', symbol: 'checkmark', tone: 'muted', action: 'cancel' };
    case 'incoming':
      return { label: 'Accept', tone: 'primary', action: 'accept' };
    case 'friends':
      return {
        label: 'Friends',
        symbol: 'checkmark',
        trailingSymbol: size === 'regular' ? 'chevron.down' : undefined,
        tone: 'muted',
        action: 'friends',
      };
  }
}

/** VoiceOver text for a state, with the person's name. */
export function friendButtonA11y(state: FriendButtonState, name: string): { label: string; hint?: string } {
  switch (state) {
    case 'none':
      return { label: `Add ${name} as a friend` };
    case 'outgoing':
      return { label: `Friend request to ${name} sent`, hint: 'Double tap to cancel the request' };
    case 'incoming':
      return { label: `Accept ${name}'s friend request` };
    case 'friends':
      return { label: `Friends with ${name}`, hint: 'Opens options' };
  }
}

export type FriendButtonProps = {
  state: FriendButtonState;
  /** The other person's name, for VoiceOver. */
  name: string;
  /** Compact sits in list rows; regular is the profile's main button (and shows Decline next to Accept). */
  size?: 'regular' | 'compact';
  /** An action for this person is running. */
  busy?: boolean;
  /** Show Decline next to Accept. On by default for the regular size; list rows leave it off and Accept alone fits. */
  showDecline?: boolean;
  onAction: (action: FriendButtonAction) => void;
};

function Pill({
  label,
  symbol,
  trailingSymbol,
  tone,
  size,
  busy,
  grow,
  accessibilityLabel,
  accessibilityHint,
  onPress,
}: Omit<FriendButtonSpec, 'action'> & {
  size: 'regular' | 'compact';
  busy: boolean;
  grow?: boolean;
  accessibilityLabel: string;
  accessibilityHint?: string;
  onPress: () => void;
}) {
  const { colors, space, radius } = useTheme();
  const primary = tone === 'primary';
  const fg: ColorToken = primary ? 'onAccent' : 'ink';
  const compact = size === 'compact';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: busy, busy }}
      disabled={busy}
      hitSlop={compact ? space.xs : 0}
      onPress={onPress}
      style={({ pressed }) => [
        {
          minHeight: compact ? 36 : 48,
          flexGrow: grow ? 1 : 0,
          flexBasis: grow ? 0 : undefined,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.xs + 2,
          paddingHorizontal: compact ? space.md : space.lg,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          backgroundColor: primary ? colors.accent : colors.surfaceMuted,
          opacity: busy ? 0.6 : 1,
        },
        pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors[fg]} />
      ) : symbol ? (
        <Icon name={symbol} size={compact ? 13 : 16} color={fg} weight="semibold" />
      ) : null}
      <AppText
        variant={compact ? 'subheadline' : 'headline'}
        color={fg}
        maxFontSizeMultiplier={1.4}
        style={{ fontWeight: '600', flexShrink: 1 }}
        numberOfLines={1}
      >
        {label}
      </AppText>
      {trailingSymbol ? <Icon name={trailingSymbol} size={11} color={fg} weight="bold" /> : null}
    </Pressable>
  );
}

/**
 * The Add friend control, in one component for every place a person appears. The label always says the
 * state you're in (Add, Requested, Accept, Friends); what a tap does is the parent's call (confirm a cancel, open the menu).
 */
export function FriendButton({ state, name, size = 'regular', busy = false, showDecline = size === 'regular', onAction }: FriendButtonProps) {
  const { space } = useTheme();
  const spec = friendButtonSpec(state, size);
  const a11y = friendButtonA11y(state, name);
  const main = (
    <Pill
      {...spec}
      size={size}
      busy={busy}
      grow={size === 'regular' || (state === 'incoming' && showDecline)}
      accessibilityLabel={a11y.label}
      accessibilityHint={a11y.hint}
      onPress={() => onAction(spec.action)}
    />
  );
  if (state !== 'incoming' || !showDecline) {
    return size === 'regular' ? <View style={{ flexDirection: 'row' }}>{main}</View> : main;
  }
  return (
    <View style={{ flexDirection: 'row', gap: space.sm }}>
      {main}
      <Pill
        label="Decline"
        tone="muted"
        size={size}
        busy={busy}
        grow
        accessibilityLabel={`Decline ${name}'s friend request`}
        onPress={() => onAction('decline')}
      />
    </View>
  );
}

