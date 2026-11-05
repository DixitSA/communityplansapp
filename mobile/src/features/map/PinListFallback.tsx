import { Pressable, ScrollView, View } from 'react-native';

import { AppText, Icon, useTheme } from '@/design';

import type { Pin } from './pins';

type PinListFallbackProps = {
  pins: Pin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  title?: string;
  description?: string;
};

/** Accessible list fallback for platforms or OS versions without the native map view. */
export function PinListFallback({
  pins,
  selectedId,
  onSelect,
  title = 'Map preview on iPhone',
  description = `Apple Maps shows these ${pins.length} ${pins.length === 1 ? 'pin' : 'pins'} on your phone.`,
}: PinListFallbackProps) {
  const { colors, space, radius } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.surfaceMuted }}
      contentContainerStyle={{ padding: space.lg, gap: space.md, paddingBottom: 190 }}
    >
      <View style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.lg }}>
        <Icon name="map" size={32} color="inkSecondary" />
        <AppText variant="headline">{title}</AppText>
        <AppText variant="footnote" color="inkSecondary" style={{ textAlign: 'center' }}>
          {description}
        </AppText>
      </View>
      {pins.map((p) => (
        <Pressable
          key={p.id}
          accessibilityRole="button"
          accessibilityLabel={`${p.title}, ${p.neighborhood}`}
          accessibilityState={{ selected: p.id === selectedId }}
          onPress={() => onSelect(p.id)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.md,
            padding: space.md,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
            borderWidth: 2,
            borderColor: p.id === selectedId ? colors.accent : 'transparent',
          }}
        >
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: p.color,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Icon name={p.symbol} size={16} tintColor={colors.onImage} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="subheadline" numberOfLines={1} style={{ fontWeight: '600' }}>
              {p.title}
            </AppText>
            <AppText variant="footnote" color="inkSecondary">
              {p.neighborhood}
            </AppText>
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}
