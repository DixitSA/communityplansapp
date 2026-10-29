import type { ChatMessage, ChatSummary } from '@/lib/api';
import { MONTHS_SHORT, WEEKDAYS_LONG, formatTime, startOfDay } from '@/lib/dates';

const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
/** The chat list only knows when an event starts, so "Now" lasts a typical evening out. */
const LIVE_WINDOW_MS = 3 * HOUR_MS;

/** A pause this long starts a new time separator. */
export const SEPARATOR_GAP_MS = HOUR_MS;
/** Messages from one person closer together than this share a group. */
export const GROUP_GAP_MS = 5 * MINUTE_MS;

// ---------------------------------------------------------------------------------------------
// Merging live changes into the message list. Lists are newest first, like the server sends them.
// ---------------------------------------------------------------------------------------------

export const TEMP_PREFIX = 'tmp:';
export const isTempId = (id: string) => id.startsWith(TEMP_PREFIX);

let tempCounter = 0;
/** An id for a message that hasn't reached the server yet. */
export const makeTempId = () => `${TEMP_PREFIX}${Date.now()}-${tempCounter++}`;

/** The message shown straight away while it is on its way to the server. */
export function makeTempMessage(id: string, body: string, now: Date = new Date()): ChatMessage {
  return {
    id,
    userId: 'me',
    displayName: 'You',
    avatarPath: null,
    body,
    createdAt: now,
    isMine: true,
    deleted: false,
    sending: true,
  };
}

/**
 * A message arrived from Realtime (or from the first page). Ignores ids we already have. When it is
 * our own message and a temporary copy with the same text is still waiting, the real one takes its
 * place, so the sender never sees it twice.
 */
export function insertMessage(list: ChatMessage[], incoming: ChatMessage): ChatMessage[] {
  if (list.some((m) => m.id === incoming.id)) return list;
  if (incoming.isMine) {
    // The oldest waiting copy first: messages are confirmed in the order they were sent.
    const waiting = [...list].reverse().find((m) => m.sending && m.body === incoming.body);
    if (waiting) return list.map((m) => (m === waiting ? incoming : m));
  }
  return [incoming, ...list];
}

/** The server confirmed our send. Swaps the temporary message for the real one (or drops it if Realtime got there first). */
export function confirmSent(list: ChatMessage[], tempId: string, real: ChatMessage): ChatMessage[] {
  if (list.some((m) => m.id === real.id)) return list.filter((m) => m.id !== tempId);
  return list.map((m) => (m.id === tempId ? real : m));
}

/** Rolls back a failed send. */
export function removeMessage(list: ChatMessage[], id: string): ChatMessage[] {
  return list.filter((m) => m.id !== id);
}

/** A message changed (today: deleted). Replaces it in place; unknown ids are ignored. */
export function updateMessage(list: ChatMessage[], updated: ChatMessage): ChatMessage[] {
  if (!list.some((m) => m.id === updated.id)) return list;
  return list.map((m) => (m.id === updated.id ? updated : m));
}

/** Marks a message deleted right away (before the server confirms). */
export function markDeleted(list: ChatMessage[], id: string): ChatMessage[] {
  return list.map((m) => (m.id === id ? { ...m, body: null, deleted: true } : m));
}

// ---------------------------------------------------------------------------------------------
// Turning messages into list rows: grouped bubbles plus time separators.
// ---------------------------------------------------------------------------------------------

export type MessageItem = {
  kind: 'message';
  key: string;
  message: ChatMessage;
  /** First bubble of a group: others' show the avatar and name here. */
  startsGroup: boolean;
  /** Last bubble of a group: gets the small "tail" corner. */
  endsGroup: boolean;
};
export type SeparatorItem = { kind: 'separator'; key: string; label: string };
export type ChatItem = MessageItem | SeparatorItem;

/** "Today 9:41 PM", "Yesterday 9:41 PM", "Mon 9:41 PM", "Oct 12, 9:41 PM". */
export function formatSeparator(date: Date, now: Date): string {
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);
  const time = formatTime(date);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days > 1 && days < 7) return `${WEEKDAYS_LONG[date.getDay()].slice(0, 3)} ${time}`;
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}, ${time}`;
}

const sameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();

/**
 * Rows for the inverted list, newest first (so index 0 sits at the bottom). A separator is placed
 * before the first message of the chat, after a long pause and when the day changes; a group
 * is a run of messages from one person with no separator and no long pause between them.
 */
export function buildChatItems(newestFirst: ChatMessage[], now: Date = new Date()): ChatItem[] {
  const chronological = [...newestFirst].reverse();
  const flags = chronological.map((m, i) => {
    const prev = chronological[i - 1];
    const gap = prev ? m.createdAt.getTime() - prev.createdAt.getTime() : Infinity;
    const separator = !prev || gap >= SEPARATOR_GAP_MS || !sameDay(prev.createdAt, m.createdAt);
    const continues = !separator && prev.userId === m.userId && gap < GROUP_GAP_MS;
    return { separator, continues };
  });

  const items: ChatItem[] = [];
  chronological.forEach((message, i) => {
    const { separator, continues } = flags[i];
    if (separator) {
      items.push({ kind: 'separator', key: `sep:${message.id}`, label: formatSeparator(message.createdAt, now) });
    }
    items.push({
      kind: 'message',
      key: message.id,
      message,
      startsGroup: !continues,
      endsGroup: !flags[i + 1] || !flags[i + 1].continues,
    });
  });
  return items.reverse();
}

/** "Maya, 9:41 PM: see you there" for VoiceOver. */
export function messageA11yLabel(message: ChatMessage): string {
  const who = message.isMine ? 'You' : message.displayName;
  const text = message.deleted || message.body === null ? 'Message deleted' : message.body;
  return `${who}, ${formatTime(message.createdAt)}: ${text}`;
}

// ---------------------------------------------------------------------------------------------
// The Chats list.
// ---------------------------------------------------------------------------------------------

/** Open chats first, closed ones in Archived. Keeps the server's order inside each. */
export function sectionChats(chats: ChatSummary[]): { upcoming: ChatSummary[]; archived: ChatSummary[] } {
  return { upcoming: chats.filter((c) => c.isOpen), archived: chats.filter((c) => !c.isOpen) };
}

const shortWeekday = (d: Date) => WEEKDAYS_LONG[d.getDay()].slice(0, 3);

/**
 * The badge on a chat row: "Tonight", "Tomorrow", "Fri", "In 9 days", or for events that already
 * happened "Now", "Today", "Yesterday", "Wed", "Oct 12".
 */
export function countdownLabel(startsAt: Date, now: Date): string {
  const days = Math.round((startOfDay(startsAt).getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (startsAt.getTime() <= now.getTime()) {
    if (now.getTime() - startsAt.getTime() < LIVE_WINDOW_MS) return 'Now';
    if (days === 0) return 'Today';
    if (days === -1) return 'Yesterday';
    if (days > -7) return shortWeekday(startsAt);
    return `${MONTHS_SHORT[startsAt.getMonth()]} ${startsAt.getDate()}`;
  }
  if (days === 0) return startsAt.getHours() >= 17 ? 'Tonight' : 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return shortWeekday(startsAt);
  if (days <= 30) return `In ${days} days`;
  return `${MONTHS_SHORT[startsAt.getMonth()]} ${startsAt.getDate()}`;
}

/** Time since the last message: "now", "5m", "3h", then "Yesterday", "Mon" or "Oct 12". */
export function relativeTime(date: Date, now: Date): string {
  const minutes = (now.getTime() - date.getTime()) / MINUTE_MS;
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${Math.floor(minutes)}m`;
  if (minutes < 60 * 24 && sameDay(date, now)) return `${Math.floor(minutes / 60)}h`;
  const days = Math.round((startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY_MS);
  if (days <= 1) return 'Yesterday';
  if (days < 7) return shortWeekday(date);
  return `${MONTHS_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** "Maya: see you there" (first name only), or a nudge when nobody has written yet. */
export function chatPreview(chat: Pick<ChatSummary, 'lastBody' | 'lastAuthorName'>): string {
  if (chat.lastBody === null) return 'No messages yet. Say hi.';
  const first = chat.lastAuthorName?.trim().split(/\s+/)[0];
  return first ? `${first}: ${chat.lastBody}` : chat.lastBody;
}

/** The unread badge text; null hides the badge. */
export function unreadBadge(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

/**
 * The header's second line: "Tonight · in 3h · 18 going". Once the event is over it reads
 * "Wed · ended · 18 went".
 */
export function chatSubtitle(
  event: { startsAt: Date; endsAt?: Date },
  goingCount: number | null,
  now: Date,
): string {
  const end = event.endsAt ?? new Date(event.startsAt.getTime() + 6 * HOUR_MS);
  const ended = now.getTime() >= end.getTime();
  const label = countdownLabel(event.startsAt, now);
  const parts: string[] = [];
  if (ended) parts.push(label === 'Now' ? 'Today' : label, 'ended');
  else if (event.startsAt.getTime() <= now.getTime()) parts.push('Happening now');
  else {
    parts.push(label);
    const minutes = Math.round((event.startsAt.getTime() - now.getTime()) / MINUTE_MS);
    if (minutes < 60) parts.push(`in ${Math.max(minutes, 1)}m`);
    else if (minutes < 60 * 24) parts.push(`in ${Math.round(minutes / 60)}h`);
  }
  if (goingCount !== null) parts.push(`${goingCount} ${ended ? 'went' : 'going'}`);
  return parts.join(' · ');
}
