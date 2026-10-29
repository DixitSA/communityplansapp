import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';
import { Avatar } from './Avatar';

export type PersonRowProps = {
  name: string;
  username: string;
  avatarUri?: string | null;
  /** Taps the whole row (the left side), e.g. to open the profile. */
  onPress?: () => void;
  /** Replaces "@username", e.g. "Requested 2d ago". */
  subtitle?: string;
  /** Right side: a FriendButton or a chevron. Sits outside the row's tap area. */
  trailing?: ReactNode;
};

/** A person in a list: face, name and @username, then an optional action. Used by Search and Friends. */
export function PersonRow({ name, username, avatarUri, onPress, subtitle, trailing }: PersonRowProps) {
  const { space } = useTheme();
  const info = (
    <>
      <Avatar name={name} uri={avatarUri} size={48} />
      <View style={{ flex: 1, gap: 1 }}>
        <AppText variant="headline" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="subheadline" color="inkSecondary" numberOfLines={1}>
          {subtitle ?? `@${username}`}
        </AppText>
      </View>
    </>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: 64, paddingVertical: space.sm }}>
      {onPress ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${name}, @${username}`}
          accessibilityHint="Opens profile"
          onPress={onPress}
          style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md, opacity: pressed ? 0.7 : 1 })}
        >
          {info}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={`${name}, @${username}`} style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          {info}
        </View>
      )}
      {trailing}
    </View>
  );
}
