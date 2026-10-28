import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '../database.types';
import { createAppleNonce } from '../nonce';
import { ApiError, errorCode } from './errors';
import type { Api, AuthSession, MyProfile } from './types';

function toSession(s: { user: { id: string; email?: string | undefined } } | null): AuthSession | null {
  return s ? { userId: s.user.id, email: s.user.email ?? null } : null;
}

/** The real API. Every Supabase call in the app lives here. */
export function createRemoteApi(supabase: SupabaseClient<Database>): Api {
  const fail = (err: unknown): never => {
    throw new ApiError(errorCode(err));
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
      const { data, error } = await supabase
        .from('interests')
        .select('id, slug, label, symbol')
        .order('sort', { ascending: true });
      if (error) fail(error);
      return data ?? [];
    },
  };
}
