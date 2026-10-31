import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, SectionList, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  Chip,
  DateStrip,
  EmptyState,
  GlassButton,
  GlassPill,
  Icon,
  PrimaryButton,
  SegmentedControl,
  Skeleton,
  useTheme,
} from '@/design';
import { agendaItemLayouts, dayToDate, sectionIndexForDay, type AgendaSection } from '@/features/feed/agenda';
import { FilterMenuChip } from '@/features/feed/FilterMenuChip';
import { DISTANCES, TIME_OPTIONS, chipStates, isDefaultFilters, type DistanceMi } from '@/features/feed/filters';
import { useFiltersStore } from '@/features/feed/filtersStore';
import { useFeedEvents } from '@/features/feed/useFeedEvents';
import { EventRowLink } from '@/features/event/EventCardLink';
import { useDemoPlans } from '@/features/event/demoPlans';
import { SuggestRow } from '@/features/submit/SuggestRow';
import { EventMap } from '@/features/map/EventMap';
import { startOfDay, toISODate } from '@/lib/dates';
import { selection } from '@/lib/haptics';
import type { FeedEvent } from '@/lib/api';

const DISTANCE_OPTIONS = DISTANCES.map((d) => ({ value: d, label: `${d} mi` }));

/** How long (ms) after a tap we ignore scroll-driven day changes, so the scroll animation can't fight the tap. */
const SCROLL_LOCK_MS = 900;
const VIEWABILITY = { itemVisiblePercentThreshold: 50 } as const;

type Section = AgendaSection<FeedEvent>;
/** The part of React Native's ViewToken we read (the type isn't exported in this RN version). */
type Token = { isViewable: boolean; item?: FeedEvent | null; section?: unknown };

export default function FeedScreen() {
  const { space, colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const { demoPlans } = useLocalSearchParams<{ demoPlans?: string }>();
  useDemoPlans(demoPlans);

  const timeOfDay = useFiltersStore((s) => s.timeOfDay);
  const interests = useFiltersStore((s) => s.interests);
  const distanceMi = useFiltersStore((s) => s.distanceMi);
  const price = useFiltersStore((s) => s.price);
  const scope = useFiltersStore((s) => s.scope);
  const view = useFiltersStore((s) => s.view);
  const selected = useFiltersStore((s) => s.selectedDay);
  const { setScope, setSelectedDay, setTimeOfDay, setDistance, setView, clearFilters } = useFiltersStore.getState();

  const { sections, dayEvents, total, dayMeta, isLoading, isError, refetch } = useFeedEvents();
  const criteria = { timeOfDay, interests, distanceMi, price, scope };
  const chips = chipStates(criteria);
  const isMap = view === 'map';

  // The list's scroll bookkeeping. Refs, not state: none of it should re-render the screen.
  const listRef = useRef<SectionList<FeedEvent, Section>>(null);
  const sectionsRef = useRef(sections);
  const lockUntil = useRef(0);
  const placed = useRef(false);
  const [todayOff, setTodayOff] = useState(false);

  useEffect(() => {
    sectionsRef.current = sections;
  });

  // Every day header is one height and every row another, so measuring one of each places the whole list
  // (getItemLayout). Then jumping to a far-off day lands exactly without drawing every row first. If a row
  // ever measures differently (e.g. text size changed mid-session), fall back to unmeasured scrolling.
  const [sizes, setSizes] = useState<{ header?: number; row?: number; mixed?: boolean }>({});
  const measure = (kind: 'header' | 'row') => (e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    // Returning the same object skips the re-render, so most rows' layouts cost nothing.
    setSizes((s) => {
      const known = s[kind];
      if (known === undefined) return { ...s, [kind]: h };
      if (!s.mixed && Math.abs(known - h) > 0.5) return { ...s, mixed: true };
      return s;
    });
  };
  const layouts = useMemo(
    () => (sizes.header && sizes.row && !sizes.mixed ? agendaItemLayouts(sections, sizes.header, sizes.row) : null),
    [sections, sizes],
  );
  const getItemLayout = useMemo(
    () => (layouts ? (_: unknown, index: number) => layouts[index] ?? { length: 0, offset: 0, index } : undefined),
    [layouts],
  );
  // A jump asked for before the list was measured waits here and runs once it is.
  const pendingSection = useRef<number | null>(null);

  const scrollToSection = useCallback((index: number, animated: boolean) => {
    lockUntil.current = Date.now() + SCROLL_LOCK_MS;
    listRef.current?.scrollToLocation({ sectionIndex: index, itemIndex: 0, viewPosition: 0, animated });
  }, []);

  useEffect(() => {
    if (!layouts || pendingSection.current === null) return;
    const index = pendingSection.current;
    pendingSection.current = null;
    scrollToSection(index, false);
  }, [layouts, scrollToSection]);

  // Tapping a day in the strip: select it and scroll to it, or to the next day that has events.
  const onSelectDay = (day: Date) => {
    setSelectedDay(day);
    if (isMap) return;
    const index = sectionIndexForDay(sections, toISODate(day));
    if (index < 0) return;
    if (layouts || index === 0) scrollToSection(index, true);
    else pendingSection.current = index;
  };

  const onToday = () => {
    selection();
    setSelectedDay(startOfDay(new Date()));
    if (sections.length > 0) scrollToSection(0, true);
  };

  // Scrolling moves the selected day to the first section on screen, and decides if "Today" shows.
  // React Native wants this callback's identity to stay the same, hence the lazy state (it reads refs, never render values).
  const [onViewableItemsChanged] = useState(() => ({ viewableItems }: { viewableItems: Token[] }) => {
    const days = viewableItems.flatMap((t) => {
      const day = (t.section as Section | undefined)?.day;
      return t.isViewable && t.item && day ? [day] : [];
    });
    if (days.length === 0 || !placed.current) return;
    days.sort();
    const first = sectionsRef.current[0]?.day;
    setTodayOff(first !== undefined && !days.includes(first));
    if (Date.now() < lockUntil.current) return;
    const current = useFiltersStore.getState().selectedDay;
    if (days[0] !== toISODate(current)) useFiltersStore.getState().setSelectedDay(dayToDate(days[0]));
  });

  const onContentSizeChange = () => {
    if (placed.current || sections.length === 0) return;
    placed.current = true;
    const index = sectionIndexForDay(sections, toISODate(selected));
    if (index <= 0) return;
    if (layouts) scrollToSection(index, false);
    else pendingSection.current = index;
  };

  const scopeControl = (
    <SegmentedControl
      options={[
        { value: 'nearby', label: 'Nearby' },
        { value: 'friends', label: 'Friends' },
      ]}
      value={scope}
      onChange={setScope}
    />
  );

  const topRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg }}>
      <AppText variant="title" color="accent" accessibilityRole="header" style={{ letterSpacing: -1 }}>
        yard.
      </AppText>
      <View style={{ flex: 1, flexDirection: 'row' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Location: Charlotte, NC"
          accessibilityHint="Opens the city picker"
          onPress={() => {
            selection();
            router.push('/city');
          }}
          style={({ pressed }) => ({
            height: 32,
            flexShrink: 1,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.xs,
            paddingHorizontal: space.md,
            borderRadius: radius.pill,
            borderCurve: 'continuous',
            backgroundColor: colors.surfaceMuted,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon name="mappin.circle.fill" size={16} color="accent" />
          <AppText variant="subheadline" numberOfLines={1} maxFontSizeMultiplier={1.3} style={{ flexShrink: 1, fontWeight: '600' }}>
            Charlotte, NC
          </AppText>
          <Icon name="chevron.down" size={10} color="inkSecondary" weight="semibold" />
        </Pressable>
      </View>
      <GlassButton symbol="gearshape" accessibilityLabel="Settings" onPress={() => router.push('/settings')} />
    </View>
  );

  const strip = (
    <View style={{ paddingTop: space.sm }}>
      <DateStrip selected={selected} onSelect={onSelectDay} dayMeta={dayMeta} />
    </View>
  );

  const filterRow = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 0, paddingTop: space.md, paddingBottom: space.sm, zIndex: 5 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        contentContainerStyle={{ gap: space.xs + 2, paddingLeft: space.lg, paddingRight: space.sm, alignItems: 'center' }}
      >
        <FilterMenuChip
          label={chips.time.label}
          symbol="clock"
          active={chips.time.active}
          options={TIME_OPTIONS}
          value={timeOfDay}
          onChange={setTimeOfDay}
        />
        <Chip
          label={chips.interests.label}
          symbol="square.grid.2x2"
          trailingSymbol="chevron.down"
          dense
          selected={chips.interests.active}
          filled
          onPress={() => router.push('/filters')}
        />
        <FilterMenuChip<DistanceMi>
          label={chips.distance.label}
          symbol="location"
          active={chips.distance.active}
          options={DISTANCE_OPTIONS}
          value={distanceMi}
          onChange={setDistance}
        />
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={isMap ? 'Show list' : 'Show map'}
        hitSlop={space.xs}
        onPress={() => {
          selection();
          // Coming back from the map, the list places itself on the selected day again.
          placed.current = false;
          setTodayOff(false);
          setView(isMap ? 'list' : 'map');
        }}
        style={{
          width: 36,
          height: 36,
          marginRight: space.lg,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.line,
        }}
      >
        {/* Icon only: with a "List" label the three chips and the toggle don't fit in 393pt. */}
        <Icon name={isMap ? 'list.bullet' : 'map'} size={18} />
      </Pressable>
    </View>
  );

  // Same order in both views: wordmark row, Nearby/Friends, date strip, filters.
  const pinned = (
    <>
      {topRow}
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>{scopeControl}</View>
      {strip}
      {filterRow}
    </>
  );

  if (isMap) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + space.md }}>
        {pinned}
        <View style={{ flex: 1, marginTop: space.xs }}>
          <EventMap events={dayEvents} day={selected} />
        </View>
      </View>
    );
  }

  const friendsOnly = scope === 'friends' && isDefaultFilters(criteria);
  const empty = isLoading ? (
    <View accessibilityLabel="Loading events" style={{ paddingHorizontal: space.lg, gap: space.sm, paddingTop: space.sm }}>
      <Skeleton width={160} height={24} />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={94} radius={radius.card} />
      ))}
    </View>
  ) : isError ? (
    <EmptyState symbol="wifi.slash" title="Couldn't load events" message="Check your connection and try again.">
      <View style={{ alignSelf: 'stretch', paddingTop: space.md, paddingHorizontal: space.lg }}>
        <Button label="Retry" onPress={refetch} />
      </View>
    </EmptyState>
  ) : total === 0 ? (
    <EmptyState symbol="sparkles" title="Nothing planned yet" message="No events in the next two weeks. Check back soon.">
      <SuggestRow />
    </EmptyState>
  ) : friendsOnly ? (
    <EmptyState
      symbol="person.2"
      title="None of your friends have plans yet"
      message="When friends tap Going, their plans show up here. Add a few friends to get started."
    >
      <View style={{ alignSelf: 'stretch', gap: space.sm, paddingTop: space.md, paddingHorizontal: space.lg }}>
        <PrimaryButton label="Find friends" onPress={() => router.navigate('/search')} />
        <Button label="Show nearby" onPress={() => setScope('nearby')} />
      </View>
    </EmptyState>
  ) : (
    <EmptyState
      symbol="line.3.horizontal.decrease.circle"
      title="No events match"
      message="Your filters leave nothing in the next two weeks. Loosen them to see more."
    >
      <View style={{ alignSelf: 'stretch', paddingTop: space.md, paddingHorizontal: space.lg }}>
        <PrimaryButton label="Clear filters" onPress={clearFilters} />
      </View>
    </EmptyState>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      {/* The whole header stays pinned; the list scrolls underneath it. */}
      <View style={{ paddingTop: insets.top + space.md, zIndex: 5 }}>{pinned}</View>
      <SectionList<FeedEvent, Section>
        ref={listRef}
        sections={sections}
        keyExtractor={(e) => e.id}
        stickySectionHeadersEnabled
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="never"
        // Draw about two screens of rows and keep a few screens around; getItemLayout makes far jumps exact anyway.
        getItemLayout={getItemLayout}
        initialNumToRender={12}
        windowSize={7}
        viewabilityConfig={VIEWABILITY}
        onViewableItemsChanged={onViewableItemsChanged}
        onContentSizeChange={onContentSizeChange}
        onScrollToIndexFailed={() => {
          // Only reachable before the list is measured (or if rows differ in height); fall back to the top.
          listRef.current?.scrollToLocation({ sectionIndex: 0, itemIndex: 0, animated: false });
        }}
        contentContainerStyle={{ paddingBottom: space.xxxl * 4, flexGrow: 1 }}
        ListEmptyComponent={empty}
        ListFooterComponent={
          <View style={{ paddingHorizontal: space.lg, paddingTop: space.md }}>{sections.length > 0 ? <SuggestRow /> : null}</View>
        }
        renderSectionHeader={({ section }) => (
          <View
            onLayout={measure('header')}
            style={{ backgroundColor: colors.canvas, paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.sm }}
          >
            <AppText
              variant="title2"
              color={section.isToday ? 'accent' : 'ink'}
              accessibilityRole="header"
              style={{ fontWeight: '700' }}
            >
              {section.title}
            </AppText>
          </View>
        )}
        renderItem={({ item }) => (
          <View onLayout={measure('row')} style={{ paddingHorizontal: space.lg, paddingBottom: space.sm }}>
            <EventRowLink event={item} />
          </View>
        )}
      />
      {todayOff ? (
        <Animated.View
          entering={FadeIn.duration(150)}
          exiting={FadeOut.duration(150)}
          style={{ position: 'absolute', left: space.lg, bottom: insets.bottom + space.xxxl * 2 }}
        >
          <GlassPill label="Today" accessibilityLabel="Scroll to today" onPress={onToday} />
        </Animated.View>
      ) : null}
    </View>
  );
}
