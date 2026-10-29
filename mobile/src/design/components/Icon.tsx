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
  clock: 'time-outline',
  'square.grid.2x2': 'grid-outline',
  location: 'navigate-outline',
  'mappin.circle.fill': 'location',
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
  checkmark: 'checkmark',
  xmark: 'close',
  'person.2.fill': 'people',
  'person.crop.circle.badge.plus': 'person-add',
  'bell.slash': 'notifications-off-outline',
  'list.bullet': 'list',
  'building.2': 'business-outline',
  'slider.horizontal.3': 'options-outline',
  'line.3.horizontal.decrease.circle': 'filter-circle-outline',
  ellipsis: 'ellipsis-horizontal',
  star: 'star-outline',
  'star.fill': 'star',
  'person.fill': 'person',
  'person.2': 'people-outline',
  'person.badge.plus': 'person-add',
  'checkmark.circle': 'checkmark-circle-outline',
  'checkmark.circle.fill': 'checkmark-circle',
  'lock.fill': 'lock-closed',
  'message.fill': 'chatbubble',
  'ticket.fill': 'ticket',
  'xmark.circle.fill': 'close-circle',
  'exclamationmark.circle.fill': 'alert-circle',
  gearshape: 'settings-outline',
  'location.fill': 'navigate',
  'envelope.fill': 'mail',
  'lock.shield.fill': 'shield-checkmark',
  'sportscourt.fill': 'basketball',
  'leaf.fill': 'leaf',
  'sun.max.fill': 'sunny',
  'person.3.fill': 'people-circle',
  laptopcomputer: 'laptop-outline',
  'tshirt.fill': 'shirt',
  'rectangle.portrait.and.arrow.right': 'log-out-outline',
  'arrow.up': 'arrow-up',
  'info.circle': 'information-circle-outline',
  'bubble.left.fill': 'chatbubble',
};

/**
 * Interest symbols come from the database as plain strings. They are SF Symbol names by contract
 * (the `interests.symbol` column), so this narrows the type; an unknown name just renders blank.
 */
export function asSymbol(name: string): SymbolName {
  return name as SymbolName;
}

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
