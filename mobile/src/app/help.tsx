import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { AppText, Icon, minTouchTarget, useTheme, type SymbolName } from '@/design';

type Item = { symbol: SymbolName; title: string; detail: string };

/**
 * Plain-words help. Each line mirrors a rule in PRD.md section 4 / 5.5 or DATA_MODEL.md,
 * and the 48-hour chat window matches `chatIsOpen` in `lib/api/chatMapping.ts`.
 */
const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'Your plans',
    items: [
      { symbol: 'heart', title: 'Interested', detail: 'Saves the event for later. Only you can see it.' },
      {
        symbol: 'person.2',
        title: 'Down if friends go',
        detail: 'Only you can see it. When the first friend taps Going, we let you know in Activity.',
      },
      {
        symbol: 'checkmark.circle',
        title: 'Going',
        detail: 'Your friends and other people going can see it. You also join the event chat.',
      },
    ],
  },
  {
    title: 'Event chats',
    items: [
      {
        symbol: 'bubble.left.and.bubble.right',
        title: 'One chat per event',
        detail: 'Just for the people going. It opens when you tap Going, and you leave it if you change your plan.',
      },
      {
        symbol: 'clock',
        title: 'When it closes',
        detail: 'The chat turns read-only 48 hours after the event ends.',
      },
    ],
  },
  {
    title: 'Popping this week',
    items: [
      {
        symbol: 'flame',
        title: 'What’s on the row',
        detail: 'Picks from the yard team, plus events with lots of people going.',
      },
    ],
  },
  {
    title: 'Friends',
    items: [
      {
        symbol: 'person.badge.plus',
        title: 'Adding friends',
        detail: 'Search for their @username, or send them an invite. Friendships are mutual: one asks, the other accepts.',
      },
      {
        symbol: 'eye',
        title: 'What friends see',
        detail: 'Friends see the events you’re Going to. Not the ones you’re only Interested in.',
      },
    ],
  },
  {
    title: 'Privacy',
    items: [
      {
        symbol: 'location.fill',
        title: 'Your location',
        detail: 'Used only to find what’s nearby. Never saved.',
      },
      {
        symbol: 'hand.raised',
        title: 'Blocking',
        detail: 'If you block someone, you stop seeing each other anywhere in yard.',
      },
    ],
  },
];

/** "How yard works": a sheet from Settings that explains plans, chats, friends and privacy. */
export default function HelpSheet() {
  const { colors, space, radius } = useTheme();
  const router = useRouter();

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
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
          How yard works
        </AppText>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Done"
          hitSlop={space.sm}
          style={{ minHeight: minTouchTarget, minWidth: minTouchTarget, alignItems: 'flex-end', justifyContent: 'center' }}
          onPress={() => router.back()}>
          <AppText variant="body" color="accent" style={{ fontWeight: '600' }}>
            Done
          </AppText>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxxl, gap: space.xl }}>
        {SECTIONS.map((section) => (
          <View key={section.title} style={{ gap: space.sm }}>
            <AppText variant="overline" color="inkSecondary" accessibilityRole="header" style={{ paddingLeft: space.xs }}>
              {section.title}
            </AppText>
            <View
              style={{
                borderRadius: radius.card,
                borderCurve: 'continuous',
                backgroundColor: colors.surface,
                paddingHorizontal: space.lg,
              }}
            >
              {section.items.map((row, i) => (
                <View
                  key={row.title}
                  accessible
                  accessibilityLabel={`${row.title}: ${row.detail}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: space.md,
                    paddingVertical: space.md,
                    borderTopWidth: i === 0 ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.line,
                  }}
                >
                  <View style={{ paddingTop: 2 }}>
                    <Icon name={row.symbol} size={18} color="accent" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <AppText variant="body" style={{ fontWeight: '600' }}>
                      {row.title}
                    </AppText>
                    <AppText variant="subheadline" color="inkSecondary">
                      {row.detail}
                    </AppText>
                  </View>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
