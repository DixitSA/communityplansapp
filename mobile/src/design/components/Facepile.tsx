import { View } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';
import { AppText } from './AppText';
import { Avatar } from './Avatar';

/**
 * "Maya is going", "Maya and Jordan are going", "Maya, Jordan + 3 friends going".
 * `names` are the people we can show; `total` is everyone going (>= names.length).
 */
export function formatFriendsLabel(names: string[], total: number): string {
  const count = Math.max(total, names.length);
  if (count === 0 || names.length === 0) return '';
  const shown = names.slice(0, 2);
  const rest = count - shown.length;
  if (rest <= 0) {
    return shown.length === 1 ? `${shown[0]} is going` : `${shown[0]} and ${shown[1]} are going`;
  }
  return `${shown.join(', ')} + ${rest} ${rest === 1 ? 'friend' : 'friends'} going`;
}

export type FacepileProps = {
  people: { id: string; name: string }[];
  total: number;
  avatarSize?: number;
  /** Use 'onImage' when the pile sits on photo/art. */
  labelColor?: ColorToken;
  /** Truncate the label to this many lines (tight layouts like the map pin card). */
  labelLines?: number;
  /** List-row size: smaller faces and a short "+N" (or "N going" with no friends). VoiceOver reads the full sentence when there are friends. */
  compact?: boolean;
};

const MAX_FACES = 3;

/**
 * Compact attendee summary for list rows: up to three friends' faces, then "+N" for everyone else
 * going. Faces are friends only (never strangers). With no friends going it is just "N going".
 */
export function formatAttendeeCount(friendsShown: number, total: number): string {
  const count = Math.max(total, friendsShown);
  if (count === 0) return '';
  if (friendsShown === 0) return `${count} going`;
  const rest = count - Math.min(friendsShown, MAX_FACES);
  return rest > 0 ? `+${rest}` : '';
}

export function Facepile({
  people,
  total,
  avatarSize: avatarSizeProp,
  labelColor = 'inkSecondary',
  labelLines,
  compact = false,
}: FacepileProps) {
  const { space } = useTheme();
  const names = people.map((p) => p.name);
  const avatarSize = avatarSizeProp ?? (compact ? 24 : 26);
  const faces = people.slice(0, MAX_FACES);
  const label = formatFriendsLabel(names, total);
  const compactText = formatAttendeeCount(people.length, total);
  if (compact ? !compactText && faces.length === 0 : !label) return null;
  const spoken = label || compactText;
  return (
    <View
      accessible
      accessibilityLabel={spoken}
      style={{ flexDirection: 'row', alignItems: 'center', gap: compact ? space.xs + 2 : space.sm }}
    >
      {faces.length > 0 ? (
        <View style={{ flexDirection: 'row' }}>
          {faces.map((p, i) => (
            <View key={p.id} style={{ marginLeft: i === 0 ? 0 : compact ? -8 : -avatarSize * 0.3 }}>
              <Avatar name={p.name} size={avatarSize} ring ringColor={compact ? 'canvas' : 'surface'} />
            </View>
          ))}
        </View>
      ) : null}
      <AppText
        variant="footnote"
        color={labelColor}
        numberOfLines={labelLines}
        style={{ flexShrink: 1 }}
      >
        {compact ? compactText : label}
      </AppText>
    </View>
  );
}
