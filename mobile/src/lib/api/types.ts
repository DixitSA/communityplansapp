import type { EventCardData } from '@/design';
import type { EventDetail } from '@/features/event/types';

import type { Tables } from '../database.types';

/** A row of `interests` (the symbol is an SF Symbol name). */
export type Interest = Pick<Tables<'interests'>, 'id' | 'slug' | 'label' | 'symbol'>;

/** Who is signed in. Kept small on purpose, so screens never see Supabase's own session type. */
export type AuthSession = { userId: string; email: string | null };

/** The viewer's own profile (never includes anything from `profiles_private`). */
export type MyProfile = {
  id: string;
  username: string;
  displayName: string;
  homeCityId: number | null;
  interests: Interest[];
};

export type OnboardingInput = {
  username: string;
  displayName: string;
  /** "YYYY-MM-DD". */
  birthdate: string;
  interestIds: number[];
  homeCityId: number;
};

/** The viewer's own plan for an event (mirrors the `rsvp_status` enum). */
export type RsvpStatus = 'interested' | 'down_if_friends' | 'going';

/** Inputs of the `get_feed` RPC, in the app's units. `day` is "YYYY-MM-DD" in the city's time zone. */
export type FeedParams = {
  cityId: number;
  day: string;
  lat: number;
  lng: number;
  radiusM: number;
  /** Omitted or empty means every interest. */
  interestIds?: number[];
  price: 'any' | 'free' | 'paid';
  mode: 'nearby' | 'friends';
};

/** Inputs of `get_feed_range`: the same filters over `days` (1 to 14) local days from `start`. */
export type FeedRangeParams = Omit<FeedParams, 'day'> & {
  /** "YYYY-MM-DD", the first day, in the city's time zone. */
  start: string;
  days: number;
};

/** A feed card plus what the map and the plan indicator need. */
export type FeedEvent = EventCardData & {
  /** The event's local day, "YYYY-MM-DD". Missing means "derive it from `startsAt`". */
  day?: string;
  lat?: number;
  lng?: number;
  neighborhood?: string;
  goingCount: number;
  myStatus: RsvpStatus | null;
};

/** The event page's data. `goingCount` is null in demo mode, where `othersGoing` is already final. */
export type EventPage = EventDetail & {
  goingCount: number | null;
  myStatus: RsvpStatus | null;
};

/** One row of the chat list (`get_my_chats`). */
export type ChatSummary = {
  eventId: string;
  title: string;
  startsAt: Date;
  imageUrl: string | null;
  goingCount: number;
  lastBody: string | null;
  lastAuthorName: string | null;
  lastAt: Date | null;
  unreadCount: number;
  /** False once the chat closed (48 h after the event). Read-only from then on. */
  isOpen: boolean;
  /** Demo mode only: lets the row draw the event's placeholder art. */
  art?: { interest: string; symbol: string };
};

/**
 * One chat message. `id` is the database id as a string; messages that haven't reached the server yet
 * carry a temporary id (see `features/chat/messages.ts`).
 */
export type ChatMessage = {
  id: string;
  userId: string;
  displayName: string;
  avatarPath: string | null;
  /** Null once the message was deleted (the server erases the text). */
  body: string | null;
  createdAt: Date;
  isMine: boolean;
  deleted: boolean;
  /** Client-only: a message we sent that the server hasn't confirmed yet. */
  sending?: boolean;
};

export type ChatSubscription = {
  /** A message arrived (or one of ours was confirmed). */
  onInsert: (message: ChatMessage) => void;
  /** A message changed: today that means it was deleted. */
  onUpdate: (message: ChatMessage) => void;
};

/** Why someone reports a message. Stored as the report's `reason` text. */
export type ReportReason = 'spam' | 'harassment' | 'other';

/** Messages per page of `get_chat_messages`. */
export const CHAT_PAGE_SIZE = 50;
/** The server refuses longer messages (and the composer stops typing at this length). */
export const CHAT_MAX_LENGTH = 2000;

export type Api = {
  sendEmailCode(email: string): Promise<void>;
  verifyEmailCode(email: string, code: string): Promise<void>;
  /** Resolves with the name Apple shared (first sign-in only), for prefilling the profile step. */
  signInWithApple(): Promise<{ givenName: string | null }>;
  signOut(): Promise<void>;
  getSession(): Promise<AuthSession | null>;
  /** Calls back on sign-in and sign-out. Returns the unsubscribe function. */
  onSessionChange(callback: (session: AuthSession | null) => void): () => void;
  getMyProfile(): Promise<MyProfile | null>;
  usernameAvailable(username: string): Promise<boolean>;
  completeOnboarding(input: OnboardingInput): Promise<void>;
  listInterests(): Promise<Interest[]>;
  /** Events for one day, ranked. Demo mode ignores `day` and returns the whole sample week. */
  getFeed(params: FeedParams): Promise<FeedEvent[]>;
  /** Events over a range of days (the agenda feed), earliest first. Each carries its local `day`. */
  getFeedRange(params: FeedRangeParams): Promise<FeedEvent[]>;
  /** One event, or null when it doesn't exist (or isn't visible). */
  getEvent(id: string): Promise<EventPage | null>;
  /** Sets the viewer's plan; null clears it. */
  setRsvp(eventId: string, status: RsvpStatus | null): Promise<void>;
  /** The chats the viewer can read: every event they're Going to, open ones first. */
  getMyChats(): Promise<ChatSummary[]>;
  /** A page of messages, newest first. Pass the oldest id you have as `beforeId` for the next page. */
  getChatMessages(eventId: string, beforeId?: string): Promise<ChatMessage[]>;
  /** Trims the text, then posts it. Rejects with `rate_limited` or a closed-chat error. */
  sendMessage(eventId: string, body: string): Promise<ChatMessage>;
  /** Soft delete (own messages only): the text is erased and the row stays as "Message deleted". */
  deleteMessage(messageId: string): Promise<void>;
  markChatRead(eventId: string): Promise<void>;
  /** Live inserts and updates for one chat. Returns the unsubscribe function. */
  subscribeToEventChat(eventId: string, handlers: ChatSubscription): () => void;
  reportMessage(messageId: string, reason: ReportReason): Promise<void>;
  blockUser(userId: string): Promise<void>;
};

/** Charlotte's row in `cities`. It is the first seeded row of an identity column (see the init migration). */
export const CHARLOTTE_CITY_ID = 1;
