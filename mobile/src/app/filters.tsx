import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Chip,
  PrimaryButton,
  RollingNumber,
  SegmentedControl,
  minTouchTarget,
  useTheme,
} from '@/design';
import {
  DISTANCES,
  INTEREST_OPTIONS,
  PRICE_OPTIONS,
  isDefaultFilters,
} from '@/features/feed/filters';
import { useFiltersStore } from '@/features/feed/filtersStore';
import { NEIGHBORHOODS } from '@/features/feed/neighborhoods';
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
  const { colors, space, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const [footerHeight, setFooterHeight] = useState(0);
  const timeOfDay = useFiltersStore((s) => s.timeOfDay);
  const interests = useFiltersStore((s) => s.interests);
  const distanceMi = useFiltersStore((s) => s.distanceMi);
  const price = useFiltersStore((s) => s.price);
  const scope = useFiltersStore((s) => s.scope);
  const neighborhood = useFiltersStore((s) => s.neighborhood);
  const { toggleInterest, setDistance, setPrice, setNeighborhood, clearFilters } = useFiltersStore.getState();
  const { filtered } = useFeedEvents();

  const isDefault = isDefaultFilters({ timeOfDay, interests, distanceMi, price, scope }) && neighborhood === null;
  // The agenda lists every matching event in the next two weeks, so the button counts those.
  const count = filtered.length;
  const distanceOptions = DISTANCES.map((d) => ({ value: String(d), label: `${d} mi` }));
  const card = {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    padding: space.md,
  } as const;

  // Native form sheets size a direct ScrollView child; a wrapping View breaks that sizing.
  // Measure the overlaid footer so the last filter can always scroll above it.
  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.canvas }}
        contentContainerStyle={{ paddingBottom: footerHeight }}
        stickyHeaderIndices={[0]}
        showsVerticalScrollIndicator={false}
      >
      {/* Keep the header in the scroll hierarchy so native form sheets cannot draw controls over it. */}
      <View style={{ backgroundColor: colors.canvas }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.lg,
          paddingTop: space.xxl,
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
          hitSlop={space.md}
          style={{ minHeight: minTouchTarget, minWidth: minTouchTarget, alignItems: 'flex-end', justifyContent: 'center' }}
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
      </View>

      <View style={{ paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.xxl }}>
        <Section title="Distance" trailing={`Within ${distanceMi} mi`}>
          <SegmentedControl
            options={distanceOptions}
            value={String(distanceMi)}
            onChange={(v) => {
              const next = DISTANCES.find((d) => String(d) === v);
              if (next !== undefined) setDistance(next);
            }}
          />
        </Section>

        <Section title="Interests">
          <View style={[card, { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }]}>
            {INTEREST_OPTIONS.map((o) => {
              const on = interests.includes(o.slug);
              return (
                <Chip
                  key={o.slug}
                  label={o.label}
                  testID={`filter-interest-${o.slug}`}
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

        <Section title="Neighborhood">
          <View style={[card, { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }]}>
            {NEIGHBORHOODS.map((h) => {
              const on = neighborhood === h.slug;
              return (
                <Chip
                  key={h.slug}
                  label={h.name}
                  testID={`filter-neighborhood-${h.slug}`}
                  symbol="mappin"
                  filled={on}
                  selected={on}
                  ring={on}
                  onPress={() => setNeighborhood(on ? null : h.slug)}
                />
              );
            })}
          </View>
        </Section>

        <Section title="Price">
          <SegmentedControl options={PRICE_OPTIONS} value={price} onChange={setPrice} />
        </Section>
      </View>
      </ScrollView>

      <View
        onLayout={({ nativeEvent }) => setFooterHeight(nativeEvent.layout.height)}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: colors.canvas, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: Math.max(insets.bottom, space.lg) }}
      >
        <PrimaryButton
          accessibilityLabel={count === 0 ? 'Nothing matches' : `Show ${count} ${count === 1 ? 'event' : 'events'}`}
          disabled={count === 0}
          onPress={() => router.back()}
        >
          {count === 0 ? (
            <AppText variant="headline" color="onAccent">
              nothing matches
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
    </>
  );
}
