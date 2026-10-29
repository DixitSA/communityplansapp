import { Pressable, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';

import { selection } from '@/lib/haptics';

import { useTheme } from '../theme';
import { interestColors } from '../tokens';
import { AppText } from './AppText';
import { Icon, type SymbolName } from './Icon';

export type InterestTileProps = {
  label: string;
  /** SF Symbol name from `interests.symbol`. */
  symbol: SymbolName;
  /** Interest slug: picks the fill color. */
  slug: string;
  selected: boolean;
  onPress: () => void;
};

/** Large tactile tile. Selecting fills it with the interest color, with a bounce and a haptic. */
export function InterestTile({ label, symbol, slug, selected, onPress }: InterestTileProps) {
  const { colors, space, radius } = useTheme();
  const reduceMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const solid = interestColors[slug] ?? colors.accent;
  const bounce = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={[{ flex: 1 }, bounce]}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={label}
        accessibilityState={{ checked: selected }}
        onPress={() => {
          selection();
          if (!reduceMotion) {
            scale.set(withSequence(withSpring(0.94, { duration: 120 }), withSpring(1, { duration: 320, dampingRatio: 0.5 })));
          }
          onPress();
        }}
        style={{
          minHeight: 108,
          padding: space.lg,
          justifyContent: 'space-between',
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: selected ? solid : colors.surface,
        }}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Icon name={symbol} size={30} tintColor={selected ? colors.onImage : solid} weight="semibold" />
          {selected ? <Icon name="checkmark.circle.fill" size={22} tintColor={colors.onImage} /> : null}
        </View>
        <AppText
          variant="headline"
          maxFontSizeMultiplier={1.4}
          style={{ color: selected ? colors.onImage : colors.ink }}
        >
          {label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}
