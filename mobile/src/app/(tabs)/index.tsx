import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Chip,
  DateStrip,
  EmptyState,
  EventCard,
  GlassButton,
  Icon,
  Screen,
  SegmentedControl,
  useTheme,
  type DayMeta,
} from '@/design';
import { getFixtureEvents } from '@/features/feed/fixtures';
import { MONTHS_LONG, WEEKDAYS_SHORT, isSameDay, startOfDay, toISODate } from '@/lib/dates';

type Scope = 'nearby' | 'friends';

// Visual only for now: the chips toggle but don't filter yet.
const FILTERS = [
  { key: 'tonight', label: 'Tonight' },
  { key: 'interests', label: 'Interests' },
  { key: 'distance', label: '10 mi' },
] as const;

export default function FeedScreen() {
  const { space, colors, radius } = useTheme();
  const [today] = useState(() => new Date());
  const [selected, setSelected] = useState(() => startOfDay(today));
  const [scope, setScope] = useState<Scope>('nearby');
  const [filters, setFilters] = useState<Record<string, boolean>>({ tonight: true });
  const [saved, setSaved] = useState<Record<string, boolean>>({});

  const events = useMemo(() => {
    const all = getFixtureEvents(today);
    return scope === 'friends' ? all.filter((e) => e.friendsGoing > 0) : all;
  }, [today, scope]);

  const dayMeta = useMemo(() => {
    const meta: Record<string, DayMeta> = {};
    for (const e of events) {
      const key = toISODate(e.startsAt);
      const m = meta[key] ?? { count: 0, friendsGoing: false };
      meta[key] = { count: m.count + 1, friendsGoing: m.friendsGoing || e.friendsGoing > 0 };
    }
    return meta;
  }, [events]);

  const dayEvents = events
    .filter((e) => isSameDay(e.startsAt, selected))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  const sectionLabel = `${WEEKDAYS_SHORT[selected.getDay()]}, ${MONTHS_LONG[selected.getMonth()].slice(0, 3)} ${selected.getDate()} · ${dayEvents.length} ${dayEvents.length === 1 ? 'EVENT' : 'EVENTS'}`;

  return (
    <Screen gutter={false}>
      <View style={{ paddingHorizontal: space.lg, gap: space.lg }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
          <AppText
            variant="title"
            color="accent"
            accessibilityRole="header"
            style={{ letterSpacing: -1 }}
          >
            yard.
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Location: Charlotte, NC"
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.xs }}
          >
            <Icon name="mappin" size={15} color="accent" />
            <AppText variant="subheadline" numberOfLines={1} style={{ flexShrink: 1 }}>
              Charlotte, NC
            </AppText>
            <Icon name="chevron.down" size={11} color="inkSecondary" weight="semibold" />
          </Pressable>
          <GlassButton symbol="bell" accessibilityLabel="Notifications" />
        </View>

        <SegmentedControl
          options={[
            { value: 'nearby', label: 'Nearby' },
            { value: 'friends', label: 'Friends' },
          ]}
          value={scope}
          onChange={setScope}
        />

        <AppText variant="largeTitle" style={{ letterSpacing: -0.8 }}>
          Find your people.
        </AppText>
      </View>

      <View style={{ paddingTop: space.sm }}>
        <DateStrip selected={selected} onSelect={setSelected} dayMeta={dayMeta} />
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          paddingHorizontal: space.lg,
          paddingTop: space.md,
        }}
      >
        {FILTERS.map((f) => (
          <Chip
            key={f.key}
            label={f.label}
            trailingSymbol="chevron.down"
            selected={!!filters[f.key]}
            filled
            onPress={() => setFilters((cur) => ({ ...cur, [f.key]: !cur[f.key] }))}
          />
        ))}
        <View style={{ flex: 1 }} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Map"
          style={{
            width: 40,
            height: 40,
            borderRadius: radius.thumb,
            borderCurve: 'continuous',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: colors.line,
          }}
        >
          <Icon name="map" size={20} />
        </Pressable>
      </View>

      <View style={{ paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.lg }}>
        <AppText variant="overline" color="inkSecondary">
          {sectionLabel}
        </AppText>
        {dayEvents.length === 0 ? (
          <EmptyState
            symbol="sparkles"
            title="Nothing planned yet"
            message="No events on this day. Try another date, or check back soon."
          />
        ) : (
          dayEvents.map((e) => (
            <EventCard
              key={e.id}
              event={e}
              saved={!!saved[e.id]}
              onToggleSave={() => setSaved((s) => ({ ...s, [e.id]: !s[e.id] }))}
            />
          ))
        )}
      </View>
    </Screen>
  );
}
