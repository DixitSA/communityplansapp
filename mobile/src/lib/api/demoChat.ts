import { usePlansStore } from '@/features/event/plansStore';
import { getFixtureEvent } from '@/features/feed/fixtures';

import { chatIsOpen, normalizeMessageBody } from './chatMapping';
import { ApiError } from './errors';
import {
  CHAT_PAGE_SIZE,
  type Api,
  type ChatMessage,
  type ChatSubscription,
  type ChatSummary,
} from './types';

export const DEMO_USER_ID = 'demo-user';
const DEMO_USER_NAME = 'Taylor Morgan';
const MINUTE_MS = 60_000;
/** The server allows 30 messages per user per event per minute. */
const RATE_LIMIT = 30;

type Room = {
  messages: ChatMessage[]; // oldest first
  lastReadAt: Date;
  sentAt: number[];
  listeners: Set<ChatSubscription>;
};

type Person = { id: string; name: string };

/** Who says a line in the sample chat: a person from the pool (by index) or the viewer. */
type Speaker = number | 'me';
/** What the sample group says: who, minutes ago, text (null text is a deleted message). */
const SCRIPT: [Speaker, number, string | null][] = [
  [0, 26 * 60, 'Okay who is in for this? I have not been in ages.'],
  [1, 26 * 60 - 4, 'Me! Say the word and I will grab us a table.'],
  [0, 190, 'Heads up, parking by the venue fills up fast.'],
  [1, 172, 'The lot on 5th is free after six and it is a short walk.'],
  ['me', 168, 'Count me in. I will bring a friend.'],
  [1, 166, null],
  [0, 41, 'Meeting out front a few minutes early?'],
  ['me', 33, 'Yes, see you there.'],
  [1, 12, 'Perfect. I will be the one in the green jacket.'],
];

const FALLBACK_POOL: Person[] = [
  { id: 'u-maya', name: 'Maya' },
  { id: 'u-jordan', name: 'Jordan' },
];

/**
 * The sample chat for demo mode: in-memory rooms seeded from the fixture events, with the same
 * behavior as the server (Going only, closed after the event, a send rate limit, blocks, soft delete).
 */
export function createDemoChat({ wait, now = () => new Date() }: {
  wait: (ms?: number) => Promise<void>;
  now?: () => Date;
}): Pick<
  Api,
  | 'getMyChats'
  | 'getChatMessages'
  | 'sendMessage'
  | 'deleteMessage'
  | 'markChatRead'
  | 'subscribeToEventChat'
  | 'reportMessage'
  | 'blockUser'
> {
  const rooms = new Map<string, Room>();
  const blocked = new Set<string>();
  let nextId = 1;
  const isGoing = (eventId: string) => usePlansStore.getState().statuses[eventId] === 'going';

  const poolFor = (eventId: string): Person[] => {
    const event = getFixtureEvent(eventId, now());
    const pool = [...(event?.friends ?? []), ...(event?.otherAttendees ?? [])];
    return pool.length >= 2 ? pool : [...pool, ...FALLBACK_POOL].slice(0, 2);
  };

  const roomOf = (eventId: string): Room => {
    let room = rooms.get(eventId);
    if (!room) {
      const pool = poolFor(eventId);
      // Chatter belongs to the event's own evening: for one that already ended, it ends with the event.
      const event = getFixtureEvent(eventId, now());
      const eventEnd = event ? (event.endsAt ?? event.startsAt).getTime() : Infinity;
      const at = Math.min(now().getTime(), eventEnd);
      const messages = SCRIPT.map(([who, minutesAgo, body]): ChatMessage => {
        const person = who === 'me' ? { id: DEMO_USER_ID, name: DEMO_USER_NAME } : pool[who % pool.length];
        return {
          id: String(nextId++),
          userId: person.id,
          displayName: person.name,
          avatarPath: null,
          body,
          createdAt: new Date(at - minutesAgo * MINUTE_MS),
          isMine: who === 'me',
          deleted: body === null,
        };
      });
      // The last message is unread, so the Chats list has a badge to show.
      room = { messages, lastReadAt: new Date(at - 20 * MINUTE_MS), sentAt: [], listeners: new Set() };
      rooms.set(eventId, room);
    }
    return room;
  };

  const visible = (room: Room) => room.messages.filter((m) => m.isMine || !blocked.has(m.userId));
  const isOpen = (eventId: string) => {
    const event = getFixtureEvent(eventId, now());
    return event ? chatIsOpen(event.startsAt, event.endsAt, now()) : false;
  };
  const findMessage = (id: string) => {
    for (const room of rooms.values()) {
      const message = room.messages.find((m) => m.id === id);
      if (message) return { room, message };
    }
    return null;
  };

  return {
    async getMyChats() {
      const goingIds = Object.entries(usePlansStore.getState().statuses)
        .filter(([, status]) => status === 'going')
        .map(([id]) => id);
      const chats: ChatSummary[] = [];
      for (const id of goingIds) {
        const event = getFixtureEvent(id, now());
        if (!event) continue;
        const room = roomOf(id);
        const messages = visible(room).filter((m) => !m.deleted);
        const last = messages[messages.length - 1];
        chats.push({
          eventId: id,
          title: event.title,
          startsAt: event.startsAt,
          imageUrl: event.imageUrl ?? null,
          goingCount: event.friendsGoing + event.othersGoing + 1,
          lastBody: last?.body ?? null,
          lastAuthorName: last?.displayName ?? null,
          lastAt: last?.createdAt ?? null,
          unreadCount: messages.filter((m) => !m.isMine && m.createdAt > room.lastReadAt).length,
          isOpen: isOpen(id),
          art: { interest: event.interest, symbol: event.symbol },
        });
      }
      // Open chats first, then the most recent activity, like the server.
      return chats.sort(
        (a, b) =>
          Number(b.isOpen) - Number(a.isOpen) ||
          (b.lastAt ?? b.startsAt).getTime() - (a.lastAt ?? a.startsAt).getTime(),
      );
    },

    async getChatMessages(eventId, beforeId) {
      if (!isGoing(eventId)) return [];
      const before = beforeId === undefined ? Infinity : Number(beforeId);
      return visible(roomOf(eventId))
        .filter((m) => Number(m.id) < before)
        .reverse()
        .slice(0, CHAT_PAGE_SIZE);
    },

    async sendMessage(eventId, text) {
      const body = normalizeMessageBody(text);
      await wait();
      if (!isGoing(eventId) || !isOpen(eventId)) throw new ApiError('chat_closed');
      const room = roomOf(eventId);
      const at = now();
      room.sentAt = room.sentAt.filter((t) => at.getTime() - t < MINUTE_MS);
      if (room.sentAt.length >= RATE_LIMIT) throw new ApiError('rate_limited');
      room.sentAt.push(at.getTime());
      const message: ChatMessage = {
        id: String(nextId++),
        userId: DEMO_USER_ID,
        displayName: DEMO_USER_NAME,
        avatarPath: null,
        body,
        createdAt: at,
        isMine: true,
        deleted: false,
      };
      room.messages.push(message);
      // Like Realtime, everyone subscribed hears about it, including the sender.
      room.listeners.forEach((l) => l.onInsert(message));
      return message;
    },

    async deleteMessage(messageId) {
      await wait();
      const found = findMessage(messageId);
      if (!found || !found.message.isMine) throw new ApiError('not_found');
      if (found.message.deleted) return;
      found.message.body = null;
      found.message.deleted = true;
      found.room.listeners.forEach((l) => l.onUpdate({ ...found.message }));
    },

    async markChatRead(eventId) {
      roomOf(eventId).lastReadAt = now();
    },

    subscribeToEventChat(eventId, handlers) {
      const room = roomOf(eventId);
      room.listeners.add(handlers);
      return () => room.listeners.delete(handlers);
    },

    async reportMessage(messageId) {
      await wait();
      if (!findMessage(messageId)) throw new ApiError('not_found');
    },

    async blockUser(userId) {
      await wait();
      blocked.add(userId);
    },
  };
}
