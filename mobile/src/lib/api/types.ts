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

/** A feed card plus what the map and the plan indicator need. */
export type FeedEvent = EventCardData & {
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
  /** One event, or null when it doesn't exist (or isn't visible). */
  getEvent(id: string): Promise<EventPage | null>;
  /** Sets the viewer's plan; null clears it. */
  setRsvp(eventId: string, status: RsvpStatus | null): Promise<void>;
};

/** Charlotte's row in `cities`. It is the first seeded row of an identity column (see the init migration). */
export const CHARLOTTE_CITY_ID = 1;
