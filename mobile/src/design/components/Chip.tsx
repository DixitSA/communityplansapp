import { Pressable, View } from 'react-native';

import { selection } from '@/lib/haptics';

import { useTheme } from '../theme';
import { categoryColors, isCategory, type ColorToken } from '../tokens';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

export type ChipTone = 'accent' | 'peach' | 'mint';

export type ChipProps = {
  label: string;
  symbol?: SymbolName;
  /** e.g. 'chevron.down' for filter chips that open a menu. */
  trailingSymbol?: SymbolName;
  selected?: boolean;
  /** Selected style: solid accent with white text (filter row) instead of the soft tint. */
  filled?: boolean;
  tone?: ChipTone;
  /** Interest slug: tints the chip with that category's tag colors. */
  category?: string;
  size?: 'regular' | 'small';
  /**
   * Reserves a 2pt border so selection doesn't shift layout. `true` draws it in the category
   * (or accent) color, `false` keeps it transparent. Leave undefined for no border at all.
   */
  ring?: boolean;
  /** Omit for a non-interactive tag. */
  onPress?: () => void;
};

const TONES: Record<ChipTone, { solid: ColorToken; soft: ColorToken; text: ColorToken }> = {
  accent: { solid: 'accent', soft: 'accentSoft', text: 'accent' },
  peach: { solid: 'peach', soft: 'peachSoft', text: 'ink' },
  mint: { solid: 'mint', soft: 'mintSoft', text: 'ink' },
};

export function Chip({
  label,
  symbol,
  trailingSymbol,
  selected = false,
  filled = false,
  tone = 'accent',
  category,
  size = 'regular',
  ring,
  onPress,
}: ChipProps) {
  const { colors, space, radius, scheme } = useTheme();
  const t = TONES[tone];
  const small = size === 'small';
  const isFilled = selected && filled;

  let bg = selected ? colors[t.soft] : colors.surfaceMuted;
  let fg: ColorToken = selected ? t.text : 'ink';
  let iconColor: ColorToken = selected ? t.solid : 'ink';
  if (isFilled) {
    bg = colors.accent;
    fg = 'onAccent';
    iconColor = 'onAccent';
  } else if (isCategory(category)) {
    bg = categoryColors[category].soft[scheme];
    fg = 'ink';
    iconColor = 'ink';
  }
  const iconSize = small ? 12 : 15;

  const content = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
        paddingHorizontal: small ? space.sm : space.md,
        paddingVertical: small ? space.xs : space.sm,
        // Regular chips are 36pt tall (matches the map/List toggle in the filter row).
        minHeight: small ? undefined : 36,
        borderRadius: radius.pill,
        borderCurve: 'continuous',
        backgroundColor: bg,
        ...(ring === undefined
          ? null
          : {
              borderWidth: 2,
              borderColor: ring ? (isCategory(category) ? categoryColors[category].solid : colors.accent) : 'transparent',
            }),
      }}
    >
      {symbol ? <Icon name={symbol} size={iconSize} color={iconColor} /> : null}
      <AppText
        variant={small ? 'caption' : 'subheadline'}
        color={fg}
        style={{ fontWeight: '500' }}
        maxFontSizeMultiplier={1.6}
      >
        {label}
      </AppText>
      {trailingSymbol ? (
        <Icon name={trailingSymbol} size={small ? 10 : 12} color={iconColor} weight="semibold" />
      ) : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={() => {
        selection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      hitSlop={space.xs}
    >
      {content}
    </Pressable>
  );
}
