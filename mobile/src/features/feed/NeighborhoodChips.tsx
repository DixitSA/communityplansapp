import { ScrollView, View } from 'react-native';

import { AppText, Chip, useTheme } from '@/design';

import type { Neighborhood } from './neighborhoods';

export type NeighborhoodChipsProps = {
  hoods: { hood: Neighborhood; count: number }[];
  /** The selected neighborhood's slug, or null for all of Charlotte. */
  selected: string | null;
  onSelect: (slug: string | null) => void;
  /** A small overline label instead of the big section title. */
  compact?: boolean;
};

/**
 * "Around Charlotte": one chip per launch neighborhood that has events, all in one neutral map-pin style (color is reserved for event categories).
 * Tapping one narrows the agenda below to it; tapping it again shows everything.
 */
export function NeighborhoodChips({ hoods, selected, onSelect, compact }: NeighborhoodChipsProps) {
  const { space } = useTheme();
  if (hoods.length === 0 && !selected) return null;
  return (
    <View style={{ gap: compact ? space.xs : space.sm, paddingTop: compact ? space.sm : space.md }}>
      {compact ? (
        <AppText
          variant="caption"
          color="inkSecondary"
          accessibilityRole="header"
          style={{ fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: space.lg }}
        >
          Around Charlotte
        </AppText>
      ) : (
        <AppText variant="title2" accessibilityRole="header" style={{ fontWeight: '700', paddingHorizontal: space.lg }}>
          Around Charlotte
        </AppText>
      )}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}
      >
        {hoods.map(({ hood, count }) => {
          const on = hood.slug === selected;
          return (
            <Chip
              key={hood.slug}
              label={`${hood.name} · ${count}`}
              symbol="mappin"
              selected={on}
              filled={on}
              ring={on}
              accessibilityLabel={`${hood.name}, ${count} ${count === 1 ? 'event' : 'events'}`}
              onPress={() => onSelect(on ? null : hood.slug)}
            />
          );
        })}
      </ScrollView>
    </View>
  );
}
