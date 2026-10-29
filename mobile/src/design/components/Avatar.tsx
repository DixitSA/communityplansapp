import { Image } from 'expo-image';
import { View } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';
import { AppText } from './AppText';

const TINTS: { bg: ColorToken; fg: ColorToken }[] = [
  { bg: 'accentSoft', fg: 'accent' },
  { bg: 'peachSoft', fg: 'ink' },
  { bg: 'mintSoft', fg: 'ink' },
];

/** Stable tint per person, so the same name always gets the same color. */
function tintFor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export type AvatarProps = {
  name: string;
  /** A photo. Initials show underneath while it loads and when there is none. */
  uri?: string | null;
  size?: number;
  /** Draws a canvas-colored ring so overlapping avatars stay separated. */
  ring?: boolean;
  /** Ring color; the surface by default, `canvas` for avatars that overlap on a card. */
  ringColor?: 'surface' | 'canvas';
};

export function Avatar({ name, uri, size = 28, ring = false, ringColor = 'surface' }: AvatarProps) {
  const { colors } = useTheme();
  const tint = tintFor(name);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderCurve: 'continuous',
        backgroundColor: colors[tint.bg],
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: ring ? 2 : 0,
        borderColor: colors[ringColor],
        overflow: 'hidden',
      }}
    >
      <AppText
        variant="caption"
        color={tint.fg}
        allowFontScaling={false}
        style={{ fontSize: Math.round(size * 0.38), lineHeight: Math.round(size * 0.46), fontWeight: '600' }}
      >
        {initialsOf(name)}
      </AppText>
      {uri ? (
        <Image
          source={{ uri }}
          contentFit="cover"
          transition={150}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          accessibilityIgnoresInvertColors
        />
      ) : null}
    </View>
  );
}
