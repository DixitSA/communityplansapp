import { Fragment, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, useTheme } from '@/design';
import type { ChatSummary } from '@/lib/api';
import { selection } from '@/lib/haptics';

import { ChatRow, CHAT_ROW_THUMB } from './ChatRow';
import { sectionChats } from './messages';

function Card({ chats, now, onOpen }: { chats: ChatSummary[]; now: Date; onOpen: (eventId: string) => void }) {
  const { colors, space, radius, scheme } = useTheme();
  return (
    <View
      style={{
        borderRadius: radius.card,
        borderCurve: 'continuous',
        overflow: 'hidden',
        backgroundColor: colors.surface,
        ...(scheme === 'dark' ? { borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line } : null),
      }}
    >
      {chats.map((chat, i) => (
        <Fragment key={chat.eventId}>
          {i > 0 ? (
            <View
              style={{
                height: StyleSheet.hairlineWidth,
                backgroundColor: colors.line,
                // Inset past the picture, like a Messages list.
                marginLeft: space.md + CHAT_ROW_THUMB + space.md,
              }}
            />
          ) : null}
          <ChatRow chat={chat} now={now} onPress={() => onOpen(chat.eventId)} />
        </Fragment>
      ))}
    </View>
  );
}

export type ChatListProps = {
  chats: ChatSummary[];
  now: Date;
  onOpen: (eventId: string) => void;
};

/** Upcoming chats, then a collapsed Archived section (chats closed 48 hours after their event). */
export function ChatList({ chats, now, onOpen }: ChatListProps) {
  const { space } = useTheme();
  const [showArchived, setShowArchived] = useState(false);
  const { upcoming, archived } = sectionChats(chats);

  return (
    <View style={{ gap: space.xl }}>
      {upcoming.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="overline" color="inkSecondary" accessibilityRole="header" style={{ paddingHorizontal: space.xs }}>
            Upcoming
          </AppText>
          <Card chats={upcoming} now={now} onOpen={onOpen} />
        </View>
      ) : null}

      {archived.length > 0 ? (
        <View style={{ gap: space.sm }}>
          <Pressable
            onPress={() => {
              selection();
              setShowArchived((v) => !v);
            }}
            accessibilityRole="button"
            accessibilityLabel={`Archived, ${archived.length} ${archived.length === 1 ? 'chat' : 'chats'}`}
            accessibilityState={{ expanded: showArchived }}
            hitSlop={space.sm}
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs }}
          >
            <AppText variant="overline" color="inkSecondary">
              Archived · {archived.length}
            </AppText>
            <Icon name={showArchived ? 'chevron.down' : 'chevron.right'} size={11} color="inkSecondary" weight="semibold" />
          </Pressable>
          {showArchived ? <Card chats={archived} now={now} onOpen={onOpen} /> : null}
        </View>
      ) : null}
    </View>
  );
}
