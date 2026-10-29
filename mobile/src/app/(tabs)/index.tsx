import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AppText,
  Button,
  Chip,
  DateStrip,
  EmptyState,
  GlassButton,
  Icon,
  PrimaryButton,
  Screen,
  SegmentedControl,
  Skeleton,
  useTheme,
} from '@/design';
import { FilterMenuChip } from '@/features/feed/FilterMenuChip';
import {
  DISTANCES,
  TIME_OPTIONS,
  chipStates,
  isDefaultFilters,
  nextDayWithEvents,
  type DistanceMi,
} from '@/features/feed/filters';
import { useFiltersStore } from '@/features/feed/filtersStore';
import { useFeedEvents } from '@/features/feed/useFeedEvents';
import { EventCardLink } from '@/features/event/EventCardLink';
import { useDemoPlans } from '@/features/event/demoPlans';
import { EventMap } from '@/features/map/EventMap';
import { MONTHS_LONG, WEEKDAYS_SHORT, formatShortDate } from '@/lib/dates';
import { selection } from '@/lib/haptics';

const DISTANCE_OPTIONS = DISTANCES.map((d) => ({ value: d, label: `${d} mi` }));

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

  const { filtered, dayEvents, dayTotal, dayMeta, isLoading, isError, refetch } = useFeedEvents();
  const criteria = { timeOfDay, interests, distanceMi, price, scope };
  const chips = chipStates(criteria);
  const isMap = view === 'map';

  const sectionLabel = `${WEEKDAYS_SHORT[selected.getDay()]}, ${MONTHS_LONG[selected.getMonth()].slice(0, 3)} ${selected.getDate()} · ${dayEvents.length} ${dayEvents.length === 1 ? 'EVENT' : 'EVENTS'}`;

  const header = (
    <>
      <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <AppText variant="title" color="accent" accessibilityRole="header" style={{ letterSpacing: -1 }}>
            yard.
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Location: Charlotte, NC"
            accessibilityHint="Opens the city picker"
            onPress={() => {
              selection();
              router.push('/city');
            }}
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs }}
          >
            <Icon name="mappin" size={15} color="accent" />
            <AppText variant="subheadline" numberOfLines={1} style={{ flexShrink: 1 }}>
              Charlotte, NC
            </AppText>
            <Icon name="chevron.down" size={11} color="inkSecondary" weight="semibold" />
          </Pressable>
          <GlassButton symbol="bell" accessibilityLabel="Notifications" onPress={() => router.push('/activity')} />
        </View>

        <SegmentedControl
          options={[
            { value: 'nearby', label: 'Nearby' },
            { value: 'friends', label: 'Friends' },
          ]}
          value={scope}
          onChange={setScope}
        />

        {isMap ? null : (
          <AppText variant="largeTitle" style={{ letterSpacing: -0.8 }}>
            Find your people.
          </AppText>
        )}
      </View>

      <View style={{ paddingTop: space.sm }}>
        <DateStrip selected={selected} onSelect={setSelectedDay} dayMeta={dayMeta} />
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.md, zIndex: 5 }}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ flex: 1 }}
          contentContainerStyle={{ gap: space.sm, paddingLeft: space.lg, paddingRight: space.sm, alignItems: 'center' }}
        >
          <FilterMenuChip
            label={chips.time.label}
            active={chips.time.active}
            options={TIME_OPTIONS}
            value={timeOfDay}
            onChange={setTimeOfDay}
          />
          <Chip
            label={chips.interests.label}
            trailingSymbol="chevron.down"
            selected={chips.interests.active}
            filled
            onPress={() => router.push('/filters')}
          />
          <FilterMenuChip<DistanceMi>
            label={chips.distance.label}
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
          {/* Icon only in both modes: with a "List" label the three chips and the toggle don't fit in 393pt. */}
          <Icon name={isMap ? 'list.bullet' : 'map'} size={18} />
        </Pressable>
      </View>
    </>
  );

  if (isMap) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.canvas, paddingTop: insets.top + space.lg }}>
        {header}
        <View style={{ flex: 1, marginTop: space.md }}>
          <EventMap events={dayEvents} day={selected} />
        </View>
      </View>
    );
  }

  const filtersOff = isDefaultFilters(criteria);
  const friendsOnly = scope === 'friends' && filtersOff;
  const nextDay = nextDayWithEvents(filtered, selected);
  const tryNextDay = nextDay ? (
    <Button
      label={`Try ${formatShortDate(nextDay)}`}
      onPress={() => {
        selection();
        setSelectedDay(nextDay);
      }}
    />
  ) : null;
  return (
    <Screen gutter={false}>
      {header}
      <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.lg }}>
        <AppText variant="overline" color="inkSecondary">
          {sectionLabel}
        </AppText>
        {isLoading ? (
          <View accessibilityLabel="Loading events" style={{ gap: space.lg }}>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} height={240} radius={radius.card} />
            ))}
          </View>
        ) : isError ? (
          <EmptyState
            symbol="wifi.slash"
            title="Couldn't load events"
            message="Check your connection and try again."
          >
            <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
              <Button label="Retry" onPress={refetch} />
            </View>
          </EmptyState>
        ) : dayEvents.length === 0 ? (
          dayTotal === 0 ? (
            <EmptyState
              symbol="sparkles"
              title="Nothing planned yet"
              message="No events on this day. Try another date, or check back soon."
            >
              {tryNextDay ? <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>{tryNextDay}</View> : null}
            </EmptyState>
          ) : (
            <EmptyState
              symbol="line.3.horizontal.decrease.circle"
              title={friendsOnly ? 'No friends going yet' : 'No events match'}
              message={
                friendsOnly
                  ? 'None of your friends are going on this day. See everything nearby instead.'
                  : 'Your filters leave nothing for this day. Loosen them to see more.'
              }
            >
              <View style={{ alignSelf: 'stretch', paddingTop: space.md, gap: space.sm }}>
                <PrimaryButton
                  label={friendsOnly ? 'Show nearby' : 'Clear filters'}
                  onPress={friendsOnly ? () => setScope('nearby') : clearFilters}
                />
                {tryNextDay}
              </View>
            </EmptyState>
          )
        ) : (
          dayEvents.map((e) => (
            <EventCardLink key={e.id} event={e} />
          ))
        )}
      </View>
    </Screen>
  );
}

