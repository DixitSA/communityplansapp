import { usePlansStore } from '@/features/event/plansStore';
import { applyFilters, type DistanceMi } from '@/features/feed/filters';
import { getFixtureEvent, getFixtureEvents, getFixtureEventsInRange } from '@/features/feed/fixtures';

import { createDemoChat } from './demoChat';
import { createDemoFriends } from './demoFriends';
import { ApiError } from './errors';
import { toISODate } from '../dates';
import { METERS_PER_MILE } from './feedMapping';
import {
  CHARLOTTE_CITY_ID,
  type Api,
  type AuthSession,
  type EventPage,
  type FeedEvent,
  type FeedParams,
  type FeedRangeParams,
  type Interest,
  type MyProfile,
  type MySubmission,
  type OnboardingInput,
} from './types';
import {
  MIN_INTERESTS,
  isAtLeast18,
  isCompleteCode,
  isValidDisplayName,
  isValidUsername,
  parseDateOnly,
} from '../validation';
import { DETAILS_MAX, LINK_MAX, SUBMISSIONS_PER_DAY, TITLE_MAX, VENUE_MAX, startsAtProblem } from '../submission';

/** The seeded `interests` table, so demo mode shows the same tiles as the real thing. */
export const DEMO_INTERESTS: Interest[] = [
  { id: 1, slug: 'nightlife', label: 'Nightlife', symbol: 'moon.stars.fill' },
  { id: 2, slug: 'music', label: 'Music', symbol: 'music.note' },
  { id: 3, slug: 'food_drinks', label: 'Food & Drinks', symbol: 'fork.knife' },
  { id: 4, slug: 'fitness', label: 'Fitness', symbol: 'figure.run' },
  { id: 5, slug: 'arts_culture', label: 'Arts & Culture', symbol: 'paintpalette.fill' },
  { id: 6, slug: 'sports', label: 'Sports', symbol: 'sportscourt.fill' },
  { id: 7, slug: 'wellness', label: 'Wellness', symbol: 'leaf.fill' },
  { id: 8, slug: 'outdoor', label: 'Outdoor', symbol: 'sun.max.fill' },
  { id: 9, slug: 'community', label: 'Community', symbol: 'person.3.fill' },
  { id: 10, slug: 'tech', label: 'Tech', symbol: 'laptopcomputer' },
  { id: 11, slug: 'fashion', label: 'Fashion', symbol: 'tshirt.fill' },
  { id: 12, slug: 'comedy', label: 'Comedy', symbol: 'theatermasks.fill' },
];

/** Shown on Profile in demo mode until someone finishes the demo onboarding. */
export const DEMO_PROFILE: MyProfile = {
  id: 'demo-user',
  username: 'taylor.morgan',
  displayName: 'Taylor Morgan',
  homeCityId: CHARLOTTE_CITY_ID,
  interests: [DEMO_INTERESTS[1], DEMO_INTERESTS[2], DEMO_INTERESTS[0]],
};

/** Usernames the fake pretends are taken, so the "taken" state can be seen. */
export const DEMO_TAKEN_USERNAMES = ['admin', 'yard', 'maya', 'jordan', 'taylor.morgan'];

/** The code the fake rejects, so the error state can be seen. Any other 6 digits works. */
export const DEMO_BAD_CODE = '000000';

const statusOf = (id: string) => usePlansStore.getState().statuses[id] ?? null;

type DemoFilterInput = Pick<FeedParams, 'interestIds' | 'radiusM' | 'price' | 'mode'>;

function applyDemoFilters(events: ReturnType<typeof getFixtureEvents>, params: DemoFilterInput): FeedEvent[] {
  const slugs = (params.interestIds ?? []).flatMap((id) => DEMO_INTERESTS.find((i) => i.id === id)?.slug ?? []);
  const matching = applyFilters(events, {
    timeOfDay: 'any',
    interests: slugs,
    // The distance chips only offer whole miles, so rounding recovers the chip value.
    distanceMi: Math.round(params.radiusM / METERS_PER_MILE) as DistanceMi,
    price: params.price,
    scope: params.mode,
  });
  return matching.map((e) => ({ ...e, day: toISODate(e.startsAt), goingCount: e.friendsGoing, myStatus: statusOf(e.id) }));
}

/** Sample feed, filtered like the server would. Ignores `day`: the Feed shows the whole sample week. */
export function demoFeed(params: FeedParams): FeedEvent[] {
  return applyDemoFilters(getFixtureEvents(new Date()), params);
}

/** Sample agenda: the sample week repeated, cut to `days` from `start` and filtered like the server would. */
export function demoFeedRange(params: FeedRangeParams): FeedEvent[] {
  const start = parseDateOnly(params.start) ?? new Date();
  const days = Math.max(1, Math.min(Math.round(params.days), 14));
  return applyDemoFilters(getFixtureEventsInRange(start, days), params);
}

/** A sample event for the event page, or null for an unknown id. */
export function demoEvent(id: string): EventPage | null {
  const e = getFixtureEvent(id);
  return e ? { ...e, goingCount: null, myStatus: statusOf(id) } : null;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * In-memory stand-in for the real API, with the same signatures and the same error codes.
 * Demo mode uses it; tests create fresh instances with `delayMs: 0`.
 */
export function createDemoApi({ delayMs = 250, now }: { delayMs?: number; now?: () => Date } = {}): Api {
  let session: AuthSession | null = null;
  let profile: MyProfile | null = null;
  const listeners = new Set<(s: AuthSession | null) => void>();
  const wait = (ms = delayMs) => (ms > 0 ? delay(ms) : Promise.resolve());
  const setSession = (s: AuthSession | null) => {
    session = s;
    listeners.forEach((l) => l(s));
  };

  const submissions: MySubmission[] = [];
  const clock = () => now?.() ?? new Date();

  const chat = createDemoChat({ wait, now });
  const { hide, ...friends } = createDemoFriends({ wait, now });

  return {
    ...chat,
    ...friends,
    async blockUser(userId) {
      await chat.blockUser(userId);
      // A blocked person vanishes from search, friends and profiles, like on the server.
      hide(userId);
    },
    async sendEmailCode(email) {
      await wait();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) throw new ApiError('validation_failed');
    },
    async verifyEmailCode(email, code) {
      await wait();
      if (!isCompleteCode(code) || code === DEMO_BAD_CODE) throw new ApiError('otp_invalid');
      setSession({ userId: 'demo-user', email: email.trim().toLowerCase() });
    },
    async signInWithApple() {
      await wait();
      setSession({ userId: 'demo-user', email: null });
      return { givenName: 'Taylor' };
    },
    async signOut() {
      session = null;
      profile = null;
      listeners.forEach((l) => l(null));
    },
    async getSession() {
      return session;
    },
    onSessionChange(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
    async getMyProfile() {
      await wait();
      return profile ?? DEMO_PROFILE;
    },
    async usernameAvailable(username) {
      await wait(delayMs / 2);
      const u = username.toLowerCase();
      return isValidUsername(u) && !DEMO_TAKEN_USERNAMES.includes(u);
    },
    async completeOnboarding(input: OnboardingInput) {
      await wait();
      const username = input.username.toLowerCase();
      const birthdate = parseDateOnly(input.birthdate);
      if (!isValidUsername(username)) throw new ApiError('username_invalid');
      if (DEMO_TAKEN_USERNAMES.includes(username)) throw new ApiError('username_taken');
      if (!isValidDisplayName(input.displayName)) throw new ApiError('display_name_invalid');
      if (!birthdate || !isAtLeast18(birthdate)) throw new ApiError('must_be_18');
      const interests = DEMO_INTERESTS.filter((i) => input.interestIds.includes(i.id));
      if (interests.length < MIN_INTERESTS) throw new ApiError('too_few_interests');
      if (input.homeCityId !== CHARLOTTE_CITY_ID) throw new ApiError('city_invalid');
      profile = {
        id: session?.userId ?? 'demo-user',
        username,
        displayName: input.displayName.trim(),
        homeCityId: input.homeCityId,
        interests,
      };
    },
    async listInterests() {
      await wait();
      return DEMO_INTERESTS;
    },
    async getFeed(params) {
      return demoFeed(params);
    },
    async getFeedRange(params) {
      return demoFeedRange(params);
    },
    async getEvent(id) {
      return demoEvent(id);
    },
    async setRsvp(eventId, status) {
      usePlansStore.getState().setStatus(eventId, status);
    },
    async submitEvent(input) {
      await wait();
      const at = clock();
      const title = input.title.trim();
      const link = input.link.trim();
      if (title.length < 1 || title.length > TITLE_MAX) throw new ApiError('title_invalid');
      if (link !== '' && (!/^https:\/\/[^\s]+$/.test(link) || link.length > LINK_MAX)) throw new ApiError('link_invalid');
      if (startsAtProblem(input.startsAt, at)) throw new ApiError('starts_at_invalid');
      if (input.cityId !== CHARLOTTE_CITY_ID) throw new ApiError('city_invalid');
      if (input.venue.trim().length > VENUE_MAX) throw new ApiError('venue_invalid');
      if (input.details.trim().length > DETAILS_MAX) throw new ApiError('details_invalid');
      const recent = submissions.filter((s) => s.createdAt.getTime() > at.getTime() - 24 * 3_600_000);
      if (recent.length >= SUBMISSIONS_PER_DAY) throw new ApiError('rate_limited');
      const row: MySubmission = { id: `demo-submission-${submissions.length + 1}`, title, status: 'pending', createdAt: at };
      submissions.unshift(row);
      return row.id;
    },
    async getMySubmissions() {
      await wait();
      return [...submissions];
    },
  };
}
