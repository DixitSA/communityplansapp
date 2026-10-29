/** Raised by every API function. `code` is the server's exact error message, or one of ours. */
export class ApiError extends Error {
  readonly code: string;
  constructor(code: string) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
  }
}

/** The `complete_onboarding` error codes (docs/DATA_MODEL.md, "How clients write"). */
export const ONBOARDING_ERROR_CODES = [
  'not_authenticated',
  'already_onboarded',
  'username_invalid',
  'username_taken',
  'display_name_invalid',
  'must_be_18',
  'too_few_interests',
  'city_invalid',
] as const;
export type OnboardingErrorCode = (typeof ONBOARDING_ERROR_CODES)[number];

export const GENERIC_ERROR = 'Something went wrong. Please try again.';

const ONBOARDING_COPY: Record<OnboardingErrorCode, string> = {
  not_authenticated: 'Your session ended. Please sign in again.',
  already_onboarded: "You're already set up. Taking you to yard.",
  username_invalid: 'Usernames use 3 to 20 letters, numbers, dots or underscores, and start with a letter or number.',
  username_taken: 'That username was just taken. Pick another.',
  display_name_invalid: 'Add a name between 1 and 50 characters.',
  must_be_18: 'yard is for people 18 and older, so we can’t create your account.',
  too_few_interests: 'Pick at least 3 interests so we can find your people.',
  city_invalid: 'We couldn’t find that city. Try Charlotte.',
};

/** Friendly copy for an onboarding error code. Unknown codes get a generic message. */
export function mapOnboardingError(code: string | null | undefined): string {
  if (code && code in ONBOARDING_COPY) return ONBOARDING_COPY[code as OnboardingErrorCode];
  return GENERIC_ERROR;
}

/** Which onboarding screen can fix this error, so a failure at the end sends people to the right place. */
export function onboardingStepForError(code: string | null | undefined): 'profile' | 'interests' | 'location' | null {
  switch (code) {
    case 'username_invalid':
    case 'username_taken':
    case 'display_name_invalid':
    case 'must_be_18':
      return 'profile';
    case 'too_few_interests':
      return 'interests';
    case 'city_invalid':
      return 'location';
    default:
      return null;
  }
}

const AUTH_COPY: Record<string, string> = {
  otp_invalid: 'That code isn’t right. Check it and try again.',
  // Supabase reports a wrong code and an expired one with the same code.
  otp_expired: 'That code is wrong or expired.',
  over_email_send_rate_limit: 'Too many codes requested. Wait a minute, then try again.',
  over_request_rate_limit: 'Too many tries. Wait a minute, then try again.',
  validation_failed: 'That email doesn’t look right.',
  email_address_invalid: 'That email doesn’t look right.',
  network: 'No connection. Check your internet and try again.',
};

/** Friendly copy for a sign-in error code (email code or Apple). */
export function mapAuthError(code: string | null | undefined): string {
  if (code && code in AUTH_COPY) return AUTH_COPY[code];
  return GENERIC_ERROR;
}

/** Reads the `code` off any thrown value. */
export function errorCode(err: unknown): string {
  if (err instanceof ApiError) return err.code;
  if (err && typeof err === 'object') {
    const e = err as { code?: unknown; message?: unknown; name?: unknown };
    // PostgREST wraps `raise exception 'must_be_18'` as { code: 'P0001', message: 'must_be_18' },
    // so for raised exceptions the message is the real code.
    if (e.code === 'P0001' && typeof e.message === 'string') return e.message;
    if (typeof e.code === 'string') return e.code;
    if (e.name === 'AuthRetryableFetchError' || (typeof e.message === 'string' && /network request failed/i.test(e.message))) {
      return 'network';
    }
    if (typeof e.message === 'string') return e.message;
  }
  return 'unknown';
}

const CHAT_COPY: Record<string, string> = {
  rate_limited: 'You’re sending messages too fast. Wait a moment, then try again.',
  chat_closed: 'This chat is closed, so you can’t send messages.',
  // Postgres "row violates row-level security": the chat closed, or the viewer is no longer Going.
  '42501': 'This chat is closed, or you’re no longer going.',
  empty_message: 'Write something first.',
  message_too_long: 'That message is too long. Keep it under 2,000 characters.',
  network: 'No connection. Check your internet and try again.',
};

/** Friendly copy for a chat error code (sending, deleting, reporting, blocking). */
export function mapChatError(code: string | null | undefined): string {
  if (code && code in CHAT_COPY) return CHAT_COPY[code];
  return GENERIC_ERROR;
}
