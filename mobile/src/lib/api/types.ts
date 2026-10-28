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
};

/** Charlotte's row in `cities`. It is the first seeded row of an identity column (see the init migration). */
export const CHARLOTTE_CITY_ID = 1;
