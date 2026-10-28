import { Stack, router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Chip,
  PrimaryButton,
  RollingNumber,
  SegmentedControl,
  useTheme,
} from '@/design';
import { DistanceSlider } from '@/features/feed/DistanceSlider';
import {
  DISTANCES,
  INTEREST_OPTIONS,
  PRICE_OPTIONS,
  isDefaultFilters,
} from '@/features/feed/filters';
import { useFiltersStore } from '@/features/feed/filtersStore';
import { useFeedEvents } from '@/features/feed/useFeedEvents';
import { selection } from '@/lib/haptics';

function Section({ title, children, trailing }: { title: string; children: React.ReactNode; trailing?: string }) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <AppText variant="overline" color="inkSecondary">
          {title}
        </AppText>
        {trailing ? (
          <AppText variant="subheadline" rounded style={{ fontWeight: '600' }}>
            {trailing}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

export default function FiltersSheet() {
  const { colors, space } = useTheme();
  const insets = useSafeAreaInsets();
  const timeOfDay = useFiltersStore((s) => s.timeOfDay);
  const interests = useFiltersStore((s) => s.interests);
  const distanceMi = useFiltersStore((s) => s.distanceMi);
  const price = useFiltersStore((s) => s.price);
  const scope = useFiltersStore((s) => s.scope);
  const { toggleInterest, setDistance, setPrice, clearFilters } = useFiltersStore.getState();
  const { dayEvents } = useFeedEvents();

  const isDefault = isDefaultFilters({ timeOfDay, interests, distanceMi, price, scope });
  const count = dayEvents.length;
  const distanceIndex = DISTANCES.indexOf(distanceMi);

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <Stack.Screen
        options={{
          presentation: 'formSheet',
          headerShown: false,
          sheetGrabberVisible: true,
          sheetAllowedDetents: [0.6, 1],
          contentStyle: { backgroundColor: colors.canvas },
        }}
      />
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.lg,
          paddingTop: space.xl,
          paddingBottom: space.md,
        }}
      >
        <AppText variant="title2" accessibilityRole="header">
          Filters
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear all filters"
          accessibilityState={{ disabled: isDefault }}
          disabled={isDefault}
          hitSlop={space.sm}
          onPress={() => {
            selection();
            clearFilters();
          }}
        >
          <AppText variant="body" color="accent" style={{ fontWeight: '600', opacity: isDefault ? 0.4 : 1 }}>
            Clear all
          </AppText>
        </Pressable>
      </View>

      {/* flexGrow 0: the button sits right under Price, and the list only scrolls if it can't fit. */}
      <ScrollView
        style={{ flexGrow: 0 }}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.xxl }}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Distance" trailing={`Within ${distanceMi} mi`}>
          <View style={{ gap: space.xs }}>
            <DistanceSlider
              index={distanceIndex}
              max={DISTANCES.length - 1}
              onIndexChange={(i) => {
                const next = DISTANCES[i];
                if (next !== undefined && next !== distanceMi) {
                  selection();
                  setDistance(next);
                }
              }}
            />
            <View
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
              style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: space.sm }}
            >
              {DISTANCES.map((d) => (
                <AppText key={d} variant="caption" color={d === distanceMi ? 'ink' : 'inkSecondary'} rounded>
                  {d}
                </AppText>
              ))}
            </View>
          </View>
        </Section>

        <Section title="Interests">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {INTEREST_OPTIONS.map((o) => {
              const on = interests.includes(o.slug);
              return (
                <Chip
                  key={o.slug}
                  label={o.label}
                  symbol={o.symbol}
                  category={on ? o.slug : undefined}
                  selected={on}
                  ring={on}
                  onPress={() => toggleInterest(o.slug)}
                />
              );
            })}
          </View>
        </Section>

        <Section title="Price">
          <SegmentedControl options={PRICE_OPTIONS} value={price} onChange={setPrice} />
        </Section>
      </ScrollView>

      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg) }}>
        <PrimaryButton
          accessibilityLabel={count === 0 ? 'No events match' : `Show ${count} ${count === 1 ? 'event' : 'events'}`}
          disabled={count === 0}
          onPress={() => router.back()}
        >
          {count === 0 ? (
            <AppText variant="headline" color="onAccent">
              No events match
            </AppText>
          ) : (
            <>
              <AppText variant="headline" color="onAccent">
                Show
              </AppText>
              <RollingNumber value={count} color="onAccent" />
              <AppText variant="headline" color="onAccent">
                {count === 1 ? 'event' : 'events'}
              </AppText>
            </>
          )}
        </PrimaryButton>
      </View>
    </View>
  );
}
