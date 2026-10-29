import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../database.types';
import { createAppleNonce } from '../nonce';
import { mapChatRow, mapMessageRow, mapTableRow, normalizeMessageBody } from './chatMapping';
import { ApiError, errorCode } from './errors';
import { mapFeedRow, parseFriends, primaryInterest, priceLabel } from './feedMapping';
import { CHAT_PAGE_SIZE, type Api, type AuthSession, type ChatMessage, type EventPage, type Interest, type MyProfile, type RsvpStatus } from './types';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toSession(s: { user: { id: string; email?: string | undefined } } | null): AuthSession | null {
  return s ? { userId: s.user.id, email: s.user.email ?? null } : null;
}

/** The real API. Every Supabase call in the app lives here. */
export function createRemoteApi(supabase: SupabaseClient<Database>): Api {
  const fail = (err: unknown): never => {
    throw new ApiError(errorCode(err));
  };

  // The interests table barely changes, so mapping reads it once per app session.
  let interestsPromise: Promise<Interest[]> | null = null;
  const loadInterests = async (): Promise<Interest[]> => {
    const { data, error } = await supabase
      .from('interests')
      .select('id, slug, label, symbol')
      .order('sort', { ascending: true });
    if (error) fail(error);
    return data ?? [];
  };
  const cachedInterests = () => {
    interestsPromise ??= loadInterests().catch((err) => {
      interestsPromise = null;
      throw err;
    });
    return interestsPromise;
  };

  // Chat helpers. Names and avatars of people who write while the chat is open are looked up once each.
  const authors = new Map<string, { displayName: string; avatarPath: string | null }>();
  const myUserId = async (): Promise<string> => {
    const { data, error } = await supabase.auth.getSession();
    if (error) fail(error);
    const uid = data.session?.user.id;
    if (!uid) throw new ApiError('not_authenticated');
    return uid;
  };
  const authorOf = async (userId: string) => {
    const known = authors.get(userId);
    if (known) return known;
    const { data } = await supabase.from('profiles').select('display_name, avatar_path').eq('id', userId).maybeSingle();
    const author = { displayName: data?.display_name ?? 'Someone', avatarPath: data?.avatar_path ?? null };
    // A failed lookup isn't cached, so the next message tries again.
    if (data) authors.set(userId, author);
    return author;
  };

  return {
    async sendEmailCode(email) {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) fail(error);
    },

    async verifyEmailCode(email, code) {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: code,
        type: 'email',
      });
      if (error) fail(error);
    },

    async signInWithApple() {
      // Loaded on demand: the module only exists as a native module on iOS.
      const AppleAuthentication = await import('expo-apple-authentication');
      // Apple gets the hash of a random nonce and Supabase the raw value, so a stolen token can't be replayed.
      const nonce = await createAppleNonce();
      let credential;
      try {
        credential = await AppleAuthentication.signInAsync({
          nonce: nonce.hashed,
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
        });
      } catch (err) {
        throw new ApiError(errorCode(err) === 'ERR_REQUEST_CANCELED' ? 'cancelled' : errorCode(err));
      }
      if (!credential.identityToken) throw new ApiError('apple_no_token');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
        nonce: nonce.raw,
      });
      if (error) fail(error);
      return { givenName: credential.fullName?.givenName ?? null };
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      if (error) fail(error);
    },

    async getSession() {
      const { data, error } = await supabase.auth.getSession();
      if (error) fail(error);
      return toSession(data.session);
    },

    onSessionChange(callback) {
      const { data } = supabase.auth.onAuthStateChange((_event, session) => callback(toSession(session)));
      return () => data.subscription.unsubscribe();
    },

    async getMyProfile(): Promise<MyProfile | null> {
      const { data: auth } = await supabase.auth.getSession();
      const uid = auth.session?.user.id;
      if (!uid) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, home_city_id, profile_interests(interests(id, slug, label, symbol))')
        .eq('id', uid)
        .maybeSingle();
      if (error) fail(error);
      if (!data) return null;
      return {
        id: data.id,
        username: data.username,
        displayName: data.display_name,
        homeCityId: data.home_city_id,
        interests: data.profile_interests.flatMap((row) => (row.interests ? [row.interests] : [])),
      };
    },

    async usernameAvailable(username) {
      const { data, error } = await supabase.rpc('username_available', { p_username: username });
      if (error) fail(error);
      return data === true;
    },

    async completeOnboarding(input) {
      const { error } = await supabase.rpc('complete_onboarding', {
        p_username: input.username,
        p_display_name: input.displayName,
        p_birthdate: input.birthdate,
        p_interest_ids: input.interestIds,
        p_home_city_id: input.homeCityId,
      });
      if (error) fail(error);
    },

    async listInterests() {
      return cachedInterests();
    },

    async getFeed(params) {
      const [{ data, error }, interests] = await Promise.all([
        supabase.rpc('get_feed', {
          p_city_id: params.cityId,
          p_day: params.day,
          p_lat: params.lat,
          p_lng: params.lng,
          p_radius_m: params.radiusM,
          p_interest_ids: params.interestIds && params.interestIds.length > 0 ? params.interestIds : undefined,
          p_price: params.price,
          p_mode: params.mode,
        }),
        cachedInterests(),
      ]);
      if (error) fail(error);
      return (data ?? []).map((row) => mapFeedRow(row, interests));
    },

    async getFeedRange(params) {
      const [{ data, error }, interests] = await Promise.all([
        supabase.rpc('get_feed_range', {
          p_city_id: params.cityId,
          p_start: params.start,
          p_days: params.days,
          p_lat: params.lat,
          p_lng: params.lng,
          p_radius_m: params.radiusM,
          p_interest_ids: params.interestIds && params.interestIds.length > 0 ? params.interestIds : undefined,
          p_price: params.price,
          p_mode: params.mode,
        }),
        cachedInterests(),
      ]);
      if (error) fail(error);
      return (data ?? []).map((row) => mapFeedRow(row, interests));
    },

    async getEvent(id) {
      // Not a UUID, so it can't be an event here (and Postgres would reject it with a type error).
      if (!UUID.test(id)) return null;
      const [eventRes, socialRes, interests] = await Promise.all([
        supabase
          .from('events')
          .select(
            'id, title, description, starts_at, ends_at, venue_name, venue_address, neighborhood, image_url, is_free, price_min, price_max, source, attribution, ticket_url, event_interests(interest_id)',
          )
          .eq('id', id)
          .maybeSingle(),
        supabase.rpc('get_event_social', { p_event_id: id }),
        cachedInterests(),
      ]);
      if (eventRes.error) fail(eventRes.error);
      if (socialRes.error) fail(socialRes.error);
      const e = eventRes.data;
      if (!e) return null;
      const social = socialRes.data?.[0];
      const friends = parseFriends(social?.friends_going);
      const interestIds = e.event_interests.map((r) => r.interest_id);
      const primary = primaryInterest(interestIds, interests);
      const page: EventPage = {
        id: e.id,
        title: e.title,
        startsAt: new Date(e.starts_at),
        endsAt: e.ends_at ? new Date(e.ends_at) : undefined,
        venue: e.venue_name ?? e.neighborhood ?? '',
        // The events table stores a geography column the client can't read; the feed card knows the distance.
        distanceMi: 0,
        imageUrl: e.image_url ?? undefined,
        interest: primary?.slug ?? 'community',
        categoryLabel: primary?.label ?? 'Event',
        symbol: (primary?.symbol ?? 'sparkles') as EventPage['symbol'],
        friends,
        friendsGoing: friends.length,
        description: e.description ?? '',
        address: e.venue_address ?? e.neighborhood ?? '',
        host: { name: e.venue_name ?? 'Host', kind: 'venue' },
        priceLabel: priceLabel(e),
        tags: interests
          .filter((i) => interestIds.includes(i.id))
          .map((i) => ({ label: i.label, interest: i.slug })),
        source:
          e.source === 'curated'
            ? { name: 'yard', curated: true }
            : { name: e.attribution ?? (e.source === 'ticketmaster' ? 'Ticketmaster' : 'SeatGeek'), url: e.ticket_url ?? undefined },
        // Other attendees' names are never sent to the client, only the count.
        otherAttendees: [],
        othersGoing: 0,
        goingCount: Number(social?.going_count ?? 0),
        myStatus: (social?.my_status as RsvpStatus | null | undefined) ?? null,
      };
      return page;
    },

    async setRsvp(eventId, status) {
      // The generated type has no `null`, but the function takes it (null clears the plan).
      const { error } = await supabase.rpc('set_rsvp', {
        p_event_id: eventId,
        p_status: status as RsvpStatus,
      });
      if (error) fail(error);
    },

    async getMyChats() {
      const { data, error } = await supabase.rpc('get_my_chats');
      if (error) fail(error);
      return (data ?? []).map(mapChatRow);
    },

    async getChatMessages(eventId, beforeId) {
      const { data, error } = await supabase.rpc('get_chat_messages', {
        p_event_id: eventId,
        p_before_id: beforeId === undefined ? undefined : Number(beforeId),
        p_limit: CHAT_PAGE_SIZE,
      });
      if (error) fail(error);
      return (data ?? []).map(mapMessageRow);
    },

    async sendMessage(eventId, text) {
      const body = normalizeMessageBody(text);
      const uid = await myUserId();
      const { data, error } = await supabase
        .from('event_messages')
        .insert({ event_id: eventId, user_id: uid, body })
        .select('id, user_id, body, created_at, deleted_at')
        .single();
      if (error) fail(error);
      return mapTableRow(data as NonNullable<typeof data>, await authorOf(uid), uid);
    },

    async deleteMessage(messageId) {
      // The only column clients may update; a trigger stamps the time and erases the text.
      const { data, error } = await supabase
        .from('event_messages')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', Number(messageId))
        .select('id');
      if (error) fail(error);
      if (!data || data.length === 0) throw new ApiError('not_found');
    },

    async markChatRead(eventId) {
      const { error } = await supabase.rpc('mark_chat_read', { p_event_id: eventId });
      if (error) fail(error);
    },

    subscribeToEventChat(eventId, handlers) {
      const channel = supabase.channel(`event-chat:${eventId}`);
      const deliver = (row: Parameters<typeof mapTableRow>[0], handler: (m: ChatMessage) => void) => {
        void (async () => {
          try {
            const [author, uid] = await Promise.all([authorOf(row.user_id), myUserId()]);
            handler(mapTableRow(row, author, uid));
          } catch {
            // A message we can't resolve shows up on the next refetch instead.
          }
        })();
      };
      channel
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'event_messages', filter: `event_id=eq.${eventId}` },
          (payload) => deliver(payload.new as Parameters<typeof mapTableRow>[0], handlers.onInsert),
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'event_messages', filter: `event_id=eq.${eventId}` },
          (payload) => deliver(payload.new as Parameters<typeof mapTableRow>[0], handlers.onUpdate),
        )
        .subscribe();
      return () => {
        void supabase.removeChannel(channel);
      };
    },

    async reportMessage(messageId, reason) {
      const uid = await myUserId();
      const { error } = await supabase
        .from('reports')
        .insert({ reporter_id: uid, target_type: 'message', target_id: messageId, reason });
      if (error) fail(error);
    },

    async blockUser(userId) {
      const uid = await myUserId();
      const { error } = await supabase.from('blocks').insert({ blocker_id: uid, blocked_id: userId });
      // Already blocked: same result the person wanted.
      if (error && error.code !== '23505') fail(error);
    },
  };
}
