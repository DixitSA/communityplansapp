import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import {
  addDays,
  isSameDay,
  startOfDay,
  startOfWeekMonday,
  toISODate,
  WEEKDAYS_LONG,
  MONTHS_LONG,
} from '@/lib/dates';
import { selection } from '@/lib/haptics';

import { useTheme } from '../theme';
import { AppText } from './AppText';

export type DayMeta = { count: number; friendsGoing: boolean };

export type DateStripProps = {
  selected: Date;
  onSelect: (date: Date) => void;
  /** Keyed by ISO date (YYYY-MM-DD). */
  dayMeta?: Record<string, DayMeta>;
};

/** The seven days (Mon–Sun) of the week containing `date`, at local midnight. */
export function getWeekDays(date: Date): Date[] {
  const monday = startOfWeekMonday(date);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

const WEEKS_BEFORE = 4;
const WEEKS_AFTER = 8;
const MAX_DOTS = 3;

/** One density dot per ~2 events, capped. */
function densityDots(count: number): number {
  return Math.min(MAX_DOTS, Math.ceil(count / 2));
}

export function DateStrip({ selected, onSelect, dayMeta = {} }: DateStripProps) {
  const { colors, space, radius } = useTheme();
  const [width, setWidth] = useState(0);
  const listRef = useRef<FlatList<Date[]>>(null);
  const pageRef = useRef(WEEKS_BEFORE);

  // The strip's weeks are anchored to the day it first showed.
  const [anchor] = useState(() => startOfWeekMonday(selected));
  const weeks = useMemo(
    () =>
      Array.from({ length: WEEKS_BEFORE + WEEKS_AFTER + 1 }, (_, i) =>
        getWeekDays(addDays(anchor, (i - WEEKS_BEFORE) * 7)),
      ),
    [anchor],
  );

  // If the selected day moves to another week (e.g. from outside), follow it.
  useEffect(() => {
    if (width === 0) return;
    const diffDays = Math.round(
      (startOfWeekMonday(selected).getTime() - anchor.getTime()) / 86_400_000,
    );
    const index = WEEKS_BEFORE + Math.round(diffDays / 7);
    if (index >= 0 && index < weeks.length && index !== pageRef.current) {
      pageRef.current = index;
      listRef.current?.scrollToIndex({ index, animated: true });
    }
  }, [selected, anchor, width, weeks.length]);

  const onLayout = useCallback((e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width), []);

  return (
    <View onLayout={onLayout}>
      {width > 0 ? (
        <FlatList
          ref={listRef}
          data={weeks}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={WEEKS_BEFORE}
          getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
          keyExtractor={(week) => toISODate(week[0])}
          onMomentumScrollEnd={(e) => {
            pageRef.current = Math.round(e.nativeEvent.contentOffset.x / width);
          }}
          renderItem={({ item: week }) => (
            <View style={{ width, flexDirection: 'row', paddingHorizontal: space.sm }}>
              {week.map((day, dayIndex) => {
                const iso = toISODate(day);
                const meta = dayMeta[iso];
                const isSelected = isSameDay(day, selected);
                const next = week[dayIndex + 1];
                const showDivider = !!next && !isSelected && !isSameDay(next, selected);
                const dots = meta ? densityDots(meta.count) : 0;
                const label = `${WEEKDAYS_LONG[day.getDay()]} ${day.getDate()} ${MONTHS_LONG[day.getMonth()]}, ${
                  meta?.count ? `${meta.count} ${meta.count === 1 ? 'event' : 'events'}` : 'no events'
                }${meta?.friendsGoing ? ', friends going' : ''}`;
                return (
                  <Pressable
                    key={iso}
                    style={{ flex: 1, alignItems: 'center', gap: space.xs }}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => {
                      if (isSelected) return;
                      selection();
                      onSelect(startOfDay(day));
                    }}
                  >
                    <View
                      style={{
                        alignSelf: 'stretch',
                        marginHorizontal: space.xs,
                        paddingVertical: space.sm,
                        alignItems: 'center',
                        borderRadius: radius.thumb,
                        borderCurve: 'continuous',
                        backgroundColor: isSelected ? colors.accent : 'transparent',
                      }}
                    >
                      <AppText
                        variant="caption"
                        color={isSelected ? 'onAccent' : 'inkSecondary'}
                        maxFontSizeMultiplier={1.4}
                      >
                        {WEEKDAYS_LONG[day.getDay()].slice(0, 3)}
                      </AppText>
                      <AppText
                        variant="headline"
                        rounded
                        color={isSelected ? 'onAccent' : 'ink'}
                        maxFontSizeMultiplier={1.4}
                      >
                        {day.getDate()}
                      </AppText>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 3, height: 5, alignItems: 'center' }}>
                      {Array.from({ length: dots }, (_, i) => (
                        <Dot key={i} color={colors.inkSecondary} size={4} opacity={0.4} />
                      ))}
                      {meta?.friendsGoing ? <Dot color={colors.accent} size={5} /> : null}
                    </View>
                    {showDivider ? (
                      <View
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: space.md,
                          height: space.xxl,
                          width: StyleSheet.hairlineWidth,
                          backgroundColor: colors.line,
                        }}
                      />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        />
      ) : null}
    </View>
  );
}

function Dot({ color, size, opacity = 1 }: { color: string; size: number; opacity?: number }) {
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, opacity }}
    />
  );
}
