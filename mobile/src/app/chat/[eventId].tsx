import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, EmptyState, Icon, Skeleton, useTheme } from '@/design';
import { ChatHeader } from '@/features/chat/ChatHeader';
import { Composer } from '@/features/chat/Composer';
import { MessageRow } from '@/features/chat/MessageRow';
import { openMessageMenu } from '@/features/chat/messageActions';
import { buildChatItems, chatSubtitle, type ChatItem } from '@/features/chat/messages';
import { useChat } from '@/features/chat/useChat';
import { useNow } from '@/features/chat/useNow';
import { openDirections } from '@/features/event/actions';
import { useDemoPlans } from '@/features/event/demoPlans';
import { useEvent } from '@/features/event/useEvent';
import { usePlan, useSetRsvp } from '@/features/event/useRsvp';
import { chatIsOpen } from '@/lib/api';
import { success } from '@/lib/haptics';
import { useHydrated } from '@/lib/useHydrated';

/** Placeholder bubbles while the first page loads. */
function LoadingBubbles({ top }: { top: number }) {
  const { space, radius } = useTheme();
  const rows = [
    { mine: false, width: '62%' },
    { mine: false, width: '44%' },
    { mine: true, width: '52%' },
    { mine: false, width: '70%' },
    { mine: true, width: '36%' },
  ] as const;
  return (
    <View
      style={{ flex: 1, paddingTop: top + space.lg, paddingHorizontal: space.lg, gap: space.md }}
      accessibilityLabel="Loading messages"
    >
      {rows.map((r, i) => (
        <View key={i} style={{ alignItems: r.mine ? 'flex-end' : 'flex-start' }}>
          <Skeleton width={r.width} height={40} radius={radius.card} />
        </View>
      ))}
    </View>
  );
}

function Separator({ label }: { label: string }) {
  const { space } = useTheme();
  return (
    <AppText
      variant="caption"
      color="inkSecondary"
      rounded
      style={{ textAlign: 'center', marginTop: space.lg, marginBottom: space.xs, fontWeight: '600' }}
    >
      {label}
    </AppText>
  );
}

export default function ChatScreen() {
  const { eventId, demoPlans } = useLocalSearchParams<{ eventId: string; demoPlans?: string }>();
  useDemoPlans(demoPlans);
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const hydrated = useHydrated();
  const now = useNow();

  const { data: event, isPending: eventPending } = useEvent(eventId);
  const plan = usePlan(eventId, event?.myStatus);
  const { setStatus } = useSetRsvp();
  const going = plan === 'going';

  const chat = useChat(eventId, going);
  const items = useMemo(() => buildChatItems(chat.messages, now), [chat.messages, now]);

  const [headerHeight, setHeaderHeight] = useState(insets.top + space.xxxl * 2);
  const open = event ? chatIsOpen(event.startsAt, event.endsAt, now) : true;

  const goBack = () => (router.canGoBack() ? router.back() : router.replace('/chats'));
  const goingCount = event
    ? (event.goingCount ?? event.friendsGoing + event.othersGoing + (going ? 1 : 0))
    : null;

  if (!hydrated) return <View style={{ flex: 1, backgroundColor: colors.canvas }} />;

  const joinChat = () => {
    success();
    setStatus(eventId, 'going');
  };

  let body;
  if (eventPending) {
    body = <LoadingBubbles top={headerHeight} />;
  } else if (!event) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: headerHeight }}>
        <EmptyState
          symbol="sparkles"
          title="We can’t find that chat"
          message="The event may have been taken down. Head back to your chats."
        />
      </View>
    );
  } else if (!going) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: headerHeight }}>
        <EmptyState
          symbol="lock.fill"
          title="Tap Going to join the chat"
          message="Only people who are going can read and send messages."
        >
          <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
            <Button variant="primary" symbol="checkmark.circle.fill" label="Going" onPress={joinChat} />
          </View>
        </EmptyState>
      </View>
    );
  } else if (chat.isPending) {
    body = <LoadingBubbles top={headerHeight} />;
  } else if (chat.isError) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: headerHeight }}>
        <EmptyState symbol="wifi.slash" title="Couldn’t load the chat" message="Check your connection and try again.">
          <View style={{ alignSelf: 'stretch', paddingTop: space.md }}>
            <Button label="Try again" onPress={() => void chat.refetch()} />
          </View>
        </EmptyState>
      </View>
    );
  } else if (chat.messages.length === 0) {
    body = (
      <View style={{ flex: 1, justifyContent: 'center', paddingTop: headerHeight }}>
        <EmptyState
          symbol="bubble.left.and.bubble.right"
          title="No messages yet"
          message={open ? 'Say hi and make a plan to meet up.' : 'Nobody wrote in this chat.'}
        />
      </View>
    );
  } else {
    body = (
      <FlatList<ChatItem>
        inverted
        data={items}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) =>
          item.kind === 'separator' ? (
            <Separator label={item.label} />
          ) : (
            <MessageRow
              item={item}
              onOpenMenu={(message) =>
                openMessageMenu(message, { onDelete: chat.deleteMessage, onBlocked: chat.refreshAfterBlock })
              }
            />
          )
        }
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        onEndReached={chat.fetchOlder}
        onEndReachedThreshold={0.5}
        // The list is flipped, so "top" padding is the gap above the newest message and "bottom" clears the header.
        contentContainerStyle={{ paddingTop: space.sm, paddingBottom: headerHeight + space.sm }}
        ListFooterComponent={
          chat.isFetchingOlder ? <ActivityIndicator style={{ padding: space.lg }} color={colors.inkSecondary} /> : undefined
        }
        extraData={width}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.canvas }}>
      <KeyboardAvoidingView behavior={process.env.EXPO_OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <View style={{ flex: 1 }}>{body}</View>
        {event && going ? (
          open ? (
            <Composer onSend={chat.send} failure={chat.failure} onDismissFailure={chat.clearFailure} />
          ) : (
            <View
              accessible
              accessibilityRole="text"
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: space.sm,
                paddingTop: space.md,
                paddingHorizontal: space.lg,
                paddingBottom: Math.max(insets.bottom, space.md),
                backgroundColor: colors.canvas,
              }}
            >
              <Icon name="lock.fill" size={14} color="inkSecondary" />
              <AppText variant="footnote" color="inkSecondary" style={{ flexShrink: 1, textAlign: 'center' }}>
                This chat closed 48 hours after the event
              </AppText>
            </View>
          )
        ) : null}
      </KeyboardAvoidingView>

      <ChatHeader
        eventId={eventId}
        title={event?.title ?? 'Chat'}
        subtitle={event ? chatSubtitle(event, goingCount, now) : ''}
        imageUrl={event?.imageUrl}
        interest={event?.interest}
        symbol={event?.symbol}
        onBack={goBack}
        onOpenEvent={() => router.push({ pathname: '/event/[id]', params: { id: eventId } })}
        onDirections={() => event && openDirections(event)}
        onLayoutHeight={setHeaderHeight}
      />
    </View>
  );
}
