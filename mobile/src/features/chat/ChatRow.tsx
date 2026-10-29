import { Image } from 'expo-image';
import { Pressable, View } from 'react-native';

import { AppText, Icon, MeshArt, useTheme, asSymbol } from '@/design';
import type { ChatSummary } from '@/lib/api';

import { chatPreview, countdownLabel, relativeTime, unreadBadge } from './messages';

export const CHAT_ROW_THUMB = 56;

export type ChatRowProps = {
  chat: ChatSummary;
  now: Date;
  onPress: () => void;
};

/** One chat in the list: event picture, title, the last message, when, and what's new. */
export function ChatRow({ chat, now, onPress }: ChatRowProps) {
  const { colors, space, radius } = useTheme();
  const unread = unreadBadge(chat.unreadCount);
  const countdown = countdownLabel(chat.startsAt, now);
  const when = chat.lastAt ? relativeTime(chat.lastAt, now) : null;
  const preview = chatPreview(chat);

  const a11y = [
    chat.title,
    chat.isOpen ? countdown : `Chat closed, ${countdown}`,
    chat.unreadCount > 0 ? `${chat.unreadCount} unread` : null,
    preview,
    when ? `${when} ago` : null,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Opens the chat"
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
        pressed && { backgroundColor: colors.surfaceMuted },
      ]}
    >
      <View
        style={{
          width: CHAT_ROW_THUMB,
          height: CHAT_ROW_THUMB,
          borderRadius: radius.thumb,
          borderCurve: 'continuous',
          overflow: 'hidden',
          opacity: chat.isOpen ? 1 : 0.6,
        }}
      >
        {chat.imageUrl ? (
          <Image source={{ uri: chat.imageUrl }} contentFit="cover" style={{ flex: 1 }} accessibilityIgnoresInvertColors />
        ) : (
          <MeshArt
            id={chat.eventId}
            interest={chat.art?.interest ?? 'community'}
            symbol={asSymbol(chat.art?.symbol ?? 'bubble.left.fill')}
            symbolSize={28}
          />
        )}
      </View>

      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
          <AppText
            variant="headline"
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
            style={{ flex: 1, fontWeight: unread ? '700' : '600' }}
          >
            {chat.title}
          </AppText>
          {when ? (
            <AppText variant="footnote" color={unread ? 'accent' : 'inkSecondary'} maxFontSizeMultiplier={1.4} rounded>
              {when}
            </AppText>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <AppText
            variant="subheadline"
            color="inkSecondary"
            numberOfLines={1}
            maxFontSizeMultiplier={1.4}
            style={{ flex: 1 }}
          >
            {preview}
          </AppText>
          {unread ? (
            <View
              style={{
                minWidth: 20,
                height: 20,
                paddingHorizontal: space.xs + 2,
                borderRadius: radius.pill,
                backgroundColor: colors.accent,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppText variant="caption" color="onAccent" style={{ fontWeight: '700' }} allowFontScaling={false} rounded>
                {unread}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.xs }}>
          <View
            style={{
              paddingHorizontal: space.sm,
              paddingVertical: 2,
              borderRadius: radius.pill,
              backgroundColor: chat.isOpen ? colors.accentSoft : colors.surfaceMuted,
            }}
          >
            <AppText
              variant="caption"
              color={chat.isOpen ? 'accent' : 'inkSecondary'}
              style={{ fontWeight: '600' }}
              maxFontSizeMultiplier={1.4}
            >
              {countdown}
            </AppText>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
            <Icon name="person.2.fill" size={11} color="inkSecondary" />
            <AppText variant="caption" color="inkSecondary" maxFontSizeMultiplier={1.4} rounded>
              {chat.goingCount}
            </AppText>
          </View>
        </View>
      </View>
    </Pressable>
  );
}
