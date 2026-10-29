import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from '@tanstack/react-query';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { CHAT_PAGE_SIZE, errorCode, mapChatError, normalizeMessageBody, type ChatMessage } from '@/lib/api';
import { chatService } from '@/lib/chat';

import {
  confirmSent,
  insertMessage,
  makeTempId,
  makeTempMessage,
  markDeleted,
  removeMessage,
  updateMessage,
} from './messages';
import { CHATS_KEY } from './useMyChats';

type Pages = InfiniteData<ChatMessage[], string | undefined>;

export const chatKey = (eventId: string) => ['chat', eventId] as const;

/** Applies `fn` to the newest page (where new messages land). */
function onFirstPage(qc: QueryClient, eventId: string, fn: (list: ChatMessage[]) => ChatMessage[]) {
  qc.setQueryData<Pages>(chatKey(eventId), (old) =>
    old && old.pages.length > 0 ? { ...old, pages: [fn(old.pages[0]), ...old.pages.slice(1)] } : old,
  );
}

/** Applies `fn` to every page (a message can be on any of them). */
function onEveryPage(qc: QueryClient, eventId: string, fn: (list: ChatMessage[]) => ChatMessage[]) {
  qc.setQueryData<Pages>(chatKey(eventId), (old) => (old ? { ...old, pages: old.pages.map(fn) } : old));
}

/** How long to wait before telling the server about new messages we've read. */
const READ_DEBOUNCE_MS = 2000;

export type SendFailure = { message: string; body: string };

/**
 * One event's chat. `messages` is newest first (what an inverted list wants). It loads older pages on
 * demand, applies live inserts and deletes from Realtime, sends optimistically, and keeps the read marker current.
 * `enabled` is false when the viewer isn't Going, so nothing is fetched or subscribed.
 */
export function useChat(eventId: string, enabled = true) {
  const qc = useQueryClient();
  const [failure, setFailure] = useState<SendFailure | null>(null);
  const focused = useRef(false);

  const query = useInfiniteQuery({
    queryKey: chatKey(eventId),
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => chatService.getChatMessages(eventId, pageParam),
    getNextPageParam: (lastPage) =>
      lastPage.length >= CHAT_PAGE_SIZE ? lastPage[lastPage.length - 1].id : undefined,
  });

  const messages = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);

  // Marking read tells the server we've seen everything up to now, which zeroes the unread badge.
  const markRead = useCallback(() => {
    if (!enabled) return;
    chatService
      .markChatRead(eventId)
      .then(() => qc.invalidateQueries({ queryKey: [CHATS_KEY] }, { cancelRefetch: false }))
      .catch(() => {
        // Not worth interrupting a conversation for; the next message tries again.
      });
  }, [enabled, eventId, qc]);

  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      markRead();
      return () => {
        focused.current = false;
      };
    }, [markRead]),
  );

  // A burst of incoming messages makes one read-marker call, not one per message.
  const readTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const markReadSoon = useCallback(() => {
    if (readTimer.current) clearTimeout(readTimer.current);
    readTimer.current = setTimeout(() => {
      readTimer.current = null;
      if (focused.current && AppState.currentState === 'active') markRead();
    }, READ_DEBOUNCE_MS);
  }, [markRead]);
  useEffect(
    () => () => {
      if (readTimer.current) clearTimeout(readTimer.current);
    },
    [],
  );

  // Realtime can miss messages: before the connection is up, after it drops, and while the app sleeps.
  // So refetch whenever it (re)connects and whenever the app comes back to the foreground.
  const catchUp = useCallback(() => {
    void qc.invalidateQueries({ queryKey: chatKey(eventId) }, { cancelRefetch: false });
    if (focused.current) markRead();
  }, [eventId, qc, markRead]);

  useEffect(() => {
    if (!enabled) return;
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') catchUp();
    });
    const unsubscribe = chatService.subscribeToEventChat(eventId, {
      onInsert: (message) => {
        onFirstPage(qc, eventId, (list) => insertMessage(list, message));
        if (!message.isMine) markReadSoon();
      },
      onUpdate: (message) => onEveryPage(qc, eventId, (list) => updateMessage(list, message)),
      onSubscribed: catchUp,
    });
    return () => {
      appState.remove();
      unsubscribe();
    };
  }, [enabled, eventId, qc, markReadSoon, catchUp]);

  const sendMutation = useMutation({
    mutationFn: ({ body }: { tempId: string; body: string }) => chatService.sendMessage(eventId, body),
    onMutate: async ({ tempId, body }) => {
      await qc.cancelQueries({ queryKey: chatKey(eventId) });
      onFirstPage(qc, eventId, (list) => [makeTempMessage(tempId, body), ...list]);
    },
    onSuccess: (real, { tempId }) => {
      onFirstPage(qc, eventId, (list) => confirmSent(list, tempId, real));
      void qc.invalidateQueries({ queryKey: [CHATS_KEY] }, { cancelRefetch: false });
    },
    onError: (err, { tempId, body }) => {
      onFirstPage(qc, eventId, (list) => removeMessage(list, tempId));
      setFailure({ message: mapChatError(errorCode(err)), body });
    },
  });

  /** Sends optimistically. Returns false when the text is empty or too long (nothing happens). */
  const send = useCallback(
    (text: string): boolean => {
      let body: string;
      try {
        body = normalizeMessageBody(text);
      } catch {
        return false;
      }
      setFailure(null);
      sendMutation.mutate({ tempId: makeTempId(), body });
      return true;
    },
    [sendMutation],
  );

  const deleteMutation = useMutation({
    mutationFn: (id: string) => chatService.deleteMessage(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: chatKey(eventId) });
      const before = qc.getQueryData<Pages>(chatKey(eventId));
      onEveryPage(qc, eventId, (list) => markDeleted(list, id));
      return { before };
    },
    onError: (_err, _id, ctx) => {
      if (ctx?.before) qc.setQueryData(chatKey(eventId), ctx.before);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: [CHATS_KEY] }),
  });

  /** Everything from someone you blocked disappears, so refetch the chat and the list. */
  const refreshAfterBlock = useCallback(() => {
    void qc.invalidateQueries({ queryKey: chatKey(eventId) });
    void qc.invalidateQueries({ queryKey: [CHATS_KEY] });
  }, [eventId, qc]);

  return {
    messages,
    isPending: query.isPending && enabled,
    isError: query.isError,
    refetch: query.refetch,
    hasOlder: query.hasNextPage,
    isFetchingOlder: query.isFetchingNextPage,
    fetchOlder: () => {
      if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage();
    },
    send,
    failure,
    clearFailure: () => setFailure(null),
    deleteMessage: deleteMutation.mutateAsync,
    refreshAfterBlock,
  };
}
