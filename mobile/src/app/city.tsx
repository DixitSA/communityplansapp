import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { AppText, Icon, useTheme } from '@/design';
import { selection } from '@/lib/haptics';

// Charlotte is the only launch city (PRD). More cities come later.
export default function CitySheet() {
  const { colors, space, radius } = useTheme();
  return (
    <View style={{ backgroundColor: colors.canvas, padding: space.lg, paddingTop: space.xxl, paddingBottom: space.xxxl, gap: space.lg }}>
      <AppText variant="title2" accessibilityRole="header">
        Choose your city
      </AppText>
      <Pressable
        accessibilityRole="radio"
        accessibilityLabel="Charlotte, North Carolina"
        accessibilityState={{ selected: true }}
        onPress={() => {
          selection();
          router.back();
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.md,
          padding: space.lg,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          backgroundColor: colors.surface,
        }}
      >
        <Icon name="mappin.circle.fill" size={24} color="accent" />
        <View style={{ flex: 1 }}>
          <AppText variant="headline">Charlotte, NC</AppText>
          <AppText variant="footnote" color="inkSecondary">
            Uptown, South End, NoDa and beyond
          </AppText>
        </View>
        <Icon name="checkmark" size={18} color="accent" weight="semibold" />
      </Pressable>
      <AppText variant="footnote" color="inkSecondary" style={{ textAlign: 'center' }}>
        More cities soon. yard starts in Charlotte, then grows from here.
      </AppText>
    </View>
  );
}
