import { Platform, Text, type TextProps } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken, TypeVariant } from '../tokens';

export type AppTextProps = TextProps & {
  variant?: TypeVariant;
  /** Color token name, never a raw hex. */
  color?: ColorToken;
  /** Rounded tabular numerals, for dates, counts and countdowns. */
  rounded?: boolean;
};

export function AppText({
  variant = 'body',
  color = 'ink',
  rounded = false,
  style,
  ...rest
}: AppTextProps) {
  const { colors, type } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        type[variant],
        { color: colors[color] },
        rounded && {
          fontFamily: Platform.select({ ios: 'ui-rounded', default: undefined }),
          fontVariant: ['tabular-nums'],
        },
        style,
      ]}
    />
  );
}
