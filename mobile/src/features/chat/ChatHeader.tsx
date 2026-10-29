import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, GlassSurface, Icon, MeshArt, categoryColors, isCategory, useTheme, type SymbolName } from '@/design';

export const CHAT_HEADER_THUMB = 36;

export type ChatHeaderProps = {
  title: string;
  subtitle: string;
  eventId: string;
  imageUrl?: string;
  interest?: string;
  symbol?: SymbolName;
  onBack: () => void;
  onOpenEvent: () => void;
  onDirections: () => void;
  onLayoutHeight?: (height: number) => void;
};

function HeaderButton({ symbol, label, onPress }: { symbol: SymbolName; label: string; onPress: () => void }) {
  const { space } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={space.xs}
      style={({ pressed }) => [
        { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
        pressed && { opacity: 0.6 },
      ]}
    >
      <Icon name={symbol} size={22} color="accent" />
    </Pressable>
  );
}

/** The pinned glass header: back, the event's picture, its title with a countdown line, and shortcuts. */
export function ChatHeader({
  title,
  subtitle,
  eventId,
  imageUrl,
  interest = 'community',
  symbol = 'bubble.left.fill',
  onBack,
  onOpenEvent,
  onDirections,
  onLayoutHeight,
}: ChatHeaderProps) {
  const { space, radius, scheme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={{ position: 'absolute', top: 0, left: 0, right: 0 }}
      onLayout={(e) => onLayoutHeight?.(e.nativeEvent.layout.height)}
    >
      <GlassSurface
        edge="bottom"
        // The category's soft tag color, so the header carries the event's mood (DESIGN.md 4.9).
        tint={isCategory(interest) ? categoryColors[interest].soft[scheme] : undefined}
        style={{
          paddingTop: insets.top + space.xs,
          paddingBottom: space.sm,
          paddingHorizontal: space.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
        }}
      >
        <HeaderButton symbol="chevron.left" label="Back" onPress={onBack} />
        <View
          style={{
            width: CHAT_HEADER_THUMB,
            height: CHAT_HEADER_THUMB,
            borderRadius: radius.thumb - space.xs,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} contentFit="cover" style={{ flex: 1 }} accessibilityIgnoresInvertColors />
          ) : (
            <MeshArt id={eventId} interest={interest} symbol={symbol} symbolSize={18} />
          )}
        </View>
        <View
          accessible
          accessibilityRole="header"
          accessibilityLabel={`${title}. ${subtitle}`}
          style={{ flex: 1, marginLeft: space.xs }}
        >
          <AppText variant="headline" numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {title}
          </AppText>
          <AppText variant="footnote" color="inkSecondary" numberOfLines={1} maxFontSizeMultiplier={1.3} rounded>
            {subtitle}
          </AppText>
        </View>
        <HeaderButton symbol="info.circle" label="Event details" onPress={onOpenEvent} />
        <HeaderButton symbol="location.fill" label="Directions" onPress={onDirections} />
      </GlassSurface>
    </View>
  );
}
