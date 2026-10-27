import { Ionicons } from '@expo/vector-icons';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../theme';
import type { ColorToken } from '../tokens';

export type SymbolName = Extract<SymbolViewProps['name'], string>;
type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

// Web/Android fallbacks. Only symbols the app actually uses are listed;
// add a line here when you use a new SF Symbol.
const FALLBACKS: Partial<Record<SymbolName, IoniconName>> = {
  sparkles: 'sparkles',
  'house.fill': 'home',
  'bubble.left.and.bubble.right': 'chatbubbles-outline',
  'person.crop.circle': 'person-circle-outline',
  magnifyingglass: 'search',
  bell: 'notifications-outline',
  heart: 'heart-outline',
  'heart.fill': 'heart',
  'chevron.left': 'chevron-back',
  'chevron.right': 'chevron-forward',
  'chevron.down': 'chevron-down',
  mappin: 'location-sharp',
  map: 'map-outline',
  'square.and.arrow.up': 'share-outline',
  'music.note': 'musical-notes',
  'fork.knife': 'restaurant',
  'figure.run': 'walk',
  'paintpalette.fill': 'color-palette',
  'theatermasks.fill': 'happy',
  'cup.and.saucer.fill': 'cafe',
  'moon.stars.fill': 'moon',
  'calendar.badge.plus': 'calendar-outline',
  'paintbrush.fill': 'brush',
};

export type IconProps = {
  name: SymbolName;
  size?: number;
  /** Color token name. */
  color?: ColorToken;
  /** Raw color override, for art overlays that need alpha. */
  tintColor?: ColorValue;
  weight?: SymbolViewProps['weight'];
  style?: StyleProp<ViewStyle>;
};

export function Icon({ name, size = 22, color = 'ink', tintColor, weight = 'medium', style }: IconProps) {
  const { colors } = useTheme();
  const tint = tintColor ?? colors[color];
  const fallbackName = FALLBACKS[name];
  const fallback = fallbackName ? (
    // ColorValue also allows numbers; Ionicons only types strings, but accepts any RN color.
    <Ionicons name={fallbackName} size={size} color={tint as string} />
  ) : (
    <View
      style={{ width: size / 3, height: size / 3, borderRadius: size / 6, backgroundColor: tint }}
    />
  );
  return (
    <View
      style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <SymbolView name={name} size={size} tintColor={tint} weight={weight} fallback={fallback} />
    </View>
  );
}
