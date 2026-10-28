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
};

const MAX_FACES = 3;

export function Facepile({ people, total, avatarSize = 26, labelColor = 'inkSecondary', labelLines }: FacepileProps) {
  const { space } = useTheme();
  const label = formatFriendsLabel(
    people.map((p) => p.name),
    total,
  );
  if (!label) return null;
  const faces = people.slice(0, MAX_FACES);
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
    >
      <View style={{ flexDirection: 'row' }}>
        {faces.map((p, i) => (
          <View key={p.id} style={{ marginLeft: i === 0 ? 0 : -avatarSize * 0.3 }}>
            <Avatar name={p.name} size={avatarSize} ring />
          </View>
        ))}
      </View>
      <AppText variant="footnote" color={labelColor} numberOfLines={labelLines} style={{ flexShrink: 1 }}>
        {label}
      </AppText>
    </View>
  );
}
