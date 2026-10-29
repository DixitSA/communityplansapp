import { useMemo, useState } from 'react';
import { View } from 'react-native';

import { AppText, useTheme, type EventCardData } from '@/design';
import { WEEKDAYS_LONG } from '@/lib/dates';

import { MapEventCard } from './MapEventCard';
import { NativeMap } from './NativeMap';
import { pinsFor } from './pins';

/** The map half of the Feed: pins for the given events, a count pill, and a card for the tapped pin. */
export function EventMap({ events, day }: { events: (EventCardData & { lat?: number; lng?: number; neighborhood?: string })[]; day: Date }) {
  const { colors, space, radius, shadow } = useTheme();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const pins = useMemo(() => pinsFor(events), [events]);
  // The selected event may disappear when filters change; then the card goes too.
  const selected = events.find((e) => e.id === selectedId) ?? null;
  const label = `${events.length} ${events.length === 1 ? 'event' : 'events'} · ${WEEKDAYS_LONG[day.getDay()].slice(0, 3)}`;

  return (
    <View style={{ flex: 1, overflow: 'hidden', borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderCurve: 'continuous' }}>
      <NativeMap
        pins={pins}
        selectedId={selected?.id ?? null}
        onSelect={(id) => setSelectedId(id)}
        onDeselect={() => setSelectedId(null)}
      />
      <View
        pointerEvents="none"
        style={[
          {
            position: 'absolute',
            top: space.md,
            left: space.lg,
            paddingHorizontal: space.md,
            paddingVertical: space.xs + 2,
            borderRadius: radius.pill,
            borderCurve: 'continuous',
            backgroundColor: colors.surface,
          },
          shadow,
        ]}
      >
        <AppText variant="footnote" style={{ fontWeight: '600' }} accessibilityLiveRegion="polite">
          {label}
        </AppText>
      </View>
      {selected ? (
        <View style={{ position: 'absolute', left: space.lg, right: space.lg, bottom: space.lg }}>
          <MapEventCard event={selected} />
        </View>
      ) : null}
    </View>
  );
}
