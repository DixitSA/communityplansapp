import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { AppText, Chip, MeshArt, useTheme } from '@/design';
import { linearGradient } from '@/design/components/meshFallback';
import { formatShortDate, formatTime } from '@/lib/dates';

import type { EventDetail } from './types';

const ART_HEIGHT = 112;
const NOTCH = 20;
const DASHES = 24;

/** Ticket-style summary of the event for the Going moment: art on top, perforation, details below. */
export function TicketCard({ event }: { event: EventDetail }) {
  const { colors, space, radius, shadow } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={`Ticket. ${event.title}. ${formatShortDate(event.startsAt)} at ${formatTime(event.startsAt)}. ${event.venue}.`}
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.sheet,
          borderCurve: 'continuous',
          overflow: 'hidden',
        },
        shadow,
      ]}
    >
      <View style={{ height: ART_HEIGHT, justifyContent: 'flex-end' }}>
        <View style={StyleSheet.absoluteFill}>
          {event.imageUrl ? (
            <Image source={{ uri: event.imageUrl }} contentFit="cover" style={{ flex: 1 }} accessibilityIgnoresInvertColors />
          ) : (
            <MeshArt id={event.id} interest={event.interest} symbol={event.symbol} symbolSize={96} />
          )}
        </View>
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            linearGradient('linear-gradient(to bottom, rgba(0,0,0,0) 20%, rgba(0,0,0,0.65) 100%)'),
          ]}
        />
        <View style={{ padding: space.md, gap: space.xs, alignItems: 'flex-start' }}>
          <Chip label={event.categoryLabel} size="small" category={event.interest} />
          <AppText variant="title2" color="onImage" numberOfLines={2}>
            {event.title}
          </AppText>
        </View>
      </View>

      {/* Perforation: a dashed line with a notch bitten out of each edge. */}
      <View style={{ height: NOTCH, justifyContent: 'center' }}>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginHorizontal: NOTCH,
          }}
        >
          {Array.from({ length: DASHES }, (_, i) => (
            <View key={i} style={{ width: 6, height: 2, borderRadius: 1, backgroundColor: colors.line }} />
          ))}
        </View>
        <View style={[styles.notch, { left: -NOTCH / 2, backgroundColor: colors.canvas }]} />
        <View style={[styles.notch, { right: -NOTCH / 2, backgroundColor: colors.canvas }]} />
      </View>

      <View style={{ flexDirection: 'row', gap: space.lg, padding: space.md, paddingTop: space.xs }}>
        <View style={{ flex: 1, gap: space.xs }}>
          <AppText variant="overline" color="inkSecondary">
            When
          </AppText>
          <AppText variant="headline">{formatShortDate(event.startsAt)}</AppText>
          <AppText variant="subheadline" color="inkSecondary" rounded>
            {formatTime(event.startsAt)}
          </AppText>
        </View>
        <View style={{ flex: 1, gap: space.xs }}>
          <AppText variant="overline" color="inkSecondary">
            Where
          </AppText>
          <AppText variant="headline" numberOfLines={2}>
            {event.venue}
          </AppText>
          <AppText variant="subheadline" color="inkSecondary" numberOfLines={1}>
            {event.distanceMi.toFixed(1)} mi away
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notch: { position: 'absolute', width: NOTCH, height: NOTCH, borderRadius: NOTCH / 2 },
});
