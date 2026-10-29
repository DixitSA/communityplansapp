import type { Tables } from '../database.types';
import { ApiError } from './errors';
import { CHAT_MAX_LENGTH, type ChatMessage, type ChatSummary } from './types';

const HOUR_MS = 3_600_000;

/** Same rule as the server's `chat_open`: open until 48 h after the event ends (else 6 h after it starts). */
export function chatIsOpen(startsAt: Date, endsAt: Date | undefined, now: Date): boolean {
  const end = endsAt ?? new Date(startsAt.getTime() + 6 * HOUR_MS);
  return now.getTime() < end.getTime() + 48 * HOUR_MS;
}

/** Trims a message and checks the client-side limits. Throws `empty_message` or `message_too_long`. */
export function normalizeMessageBody(text: string): string {
  const body = text.trim();
  if (body === '') throw new ApiError('empty_message');
  if (body.length > CHAT_MAX_LENGTH) throw new ApiError('message_too_long');
  return body;
}

type MessageRow = {
  id: number;
  user_id: string;
  display_name: string;
  avatar_path: string | null;
  body: string | null;
  created_at: string;
  is_mine: boolean;
};

/** A `get_chat_messages` row. */
export function mapMessageRow(row: MessageRow): ChatMessage {
  return {
    id: String(row.id),
    userId: row.user_id,
    displayName: row.display_name,
    avatarPath: row.avatar_path,
    body: row.body,
    createdAt: new Date(row.created_at),
    isMine: row.is_mine,
    deleted: row.body === null,
  };
}

/** A raw `event_messages` row (realtime payload or insert result) plus who wrote it. */
export function mapTableRow(
  row: Pick<Tables<'event_messages'>, 'id' | 'user_id' | 'body' | 'created_at' | 'deleted_at'>,
  author: { displayName: string; avatarPath: string | null },
  myUserId: string | null,
): ChatMessage {
  const deleted = row.deleted_at !== null || row.body === null;
  return {
    id: String(row.id),
    userId: row.user_id,
    displayName: author.displayName,
    avatarPath: author.avatarPath,
    body: deleted ? null : row.body,
    createdAt: new Date(row.created_at),
    isMine: row.user_id === myUserId,
    deleted,
  };
}

type ChatRow = {
  event_id: string;
  title: string;
  starts_at: string;
  image_url: string | null;
  going_count: number;
  last_body: string | null;
  last_author_name: string | null;
  last_at: string | null;
  unread_count: number;
  is_open: boolean;
};

/** A `get_my_chats` row. */
export function mapChatRow(row: ChatRow): ChatSummary {
  return {
    eventId: row.event_id,
    title: row.title,
    startsAt: new Date(row.starts_at),
    imageUrl: row.image_url,
    goingCount: row.going_count,
    lastBody: row.last_body,
    lastAuthorName: row.last_author_name,
    lastAt: row.last_at ? new Date(row.last_at) : null,
    unreadCount: row.unread_count,
    isOpen: row.is_open,
  };
}
