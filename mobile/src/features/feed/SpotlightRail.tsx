import { FlatList, View, useWindowDimensions } from 'react-native';

import { AppText, Icon, useTheme } from '@/design';
import { EventCardLink } from '@/features/event/EventCardLink';
import type { SpotlightEvent } from '@/lib/api';

/** How much of the next card shows at the edge, so the row reads as swipeable. */
const PEEK = 36;

export type SpotlightRailProps = { events: SpotlightEvent[] };

/** "popping this week": a swipeable row of compact event cards at the top of the feed. */
export function SpotlightRail({ events }: SpotlightRailProps) {
  const { space } = useTheme();
  const { width } = useWindowDimensions();
  const cardWidth = width - space.lg * 2 - PEEK;

  return (
    <View style={{ gap: space.sm, paddingTop: space.md, paddingBottom: space.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg }}>
        <Icon name="flame.fill" size={24} color="hot" />
        <AppText variant="sectionTitle" accessibilityRole="header">
          popping this week
        </AppText>
      </View>
      <FlatList
        horizontal
        data={events}
        keyExtractor={(e) => e.id}
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + space.md}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            <EventCardLink event={item} size="compact" />
          </View>
        )}
      />
    </View>
  );
}
