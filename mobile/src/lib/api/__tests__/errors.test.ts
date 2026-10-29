import {
  ApiError,
  GENERIC_ERROR,
  FRIEND_ERROR_CODES,
  ONBOARDING_ERROR_CODES,
  errorCode,
  mapAuthError,
  mapFriendError,
  mapOnboardingError,
  onboardingStepForError,
} from '../errors';

describe('mapOnboardingError', () => {
  it('has friendly copy for every server error code', () => {
    for (const code of ONBOARDING_ERROR_CODES) {
      const copy = mapOnboardingError(code);
      expect(copy).not.toBe(GENERIC_ERROR);
      expect(copy).not.toContain('_');
    }
  });

  it('says the right thing for the common ones', () => {
    expect(mapOnboardingError('username_taken')).toMatch(/taken/);
    expect(mapOnboardingError('must_be_18')).toMatch(/18/);
    expect(mapOnboardingError('too_few_interests')).toMatch(/3/);
  });

  it('falls back to a generic message for unknown, empty and missing codes', () => {
    expect(mapOnboardingError('boom')).toBe(GENERIC_ERROR);
    expect(mapOnboardingError('')).toBe(GENERIC_ERROR);
    expect(mapOnboardingError(null)).toBe(GENERIC_ERROR);
    expect(mapOnboardingError(undefined)).toBe(GENERIC_ERROR);
  });
});

describe('onboardingStepForError', () => {
  it('points each error at the screen that can fix it', () => {
    expect(onboardingStepForError('username_taken')).toBe('profile');
    expect(onboardingStepForError('username_invalid')).toBe('profile');
    expect(onboardingStepForError('display_name_invalid')).toBe('profile');
    expect(onboardingStepForError('must_be_18')).toBe('profile');
    expect(onboardingStepForError('too_few_interests')).toBe('interests');
    expect(onboardingStepForError('city_invalid')).toBe('location');
    expect(onboardingStepForError('not_authenticated')).toBeNull();
    expect(onboardingStepForError('whatever')).toBeNull();
  });
});

describe('mapAuthError', () => {
  it('explains wrong, expired and rate-limited codes', () => {
    expect(mapAuthError('otp_invalid')).toMatch(/isn’t right/);
    expect(mapAuthError('otp_expired')).toMatch(/wrong or expired/);
    expect(mapAuthError('over_email_send_rate_limit')).toMatch(/Wait/);
    expect(mapAuthError('network')).toMatch(/connection/);
    expect(mapAuthError('???')).toBe(GENERIC_ERROR);
  });
});

describe('errorCode', () => {
  it('reads the code from our errors, Supabase errors and plain messages', () => {
    expect(errorCode(new ApiError('username_taken'))).toBe('username_taken');
    expect(errorCode({ code: 'otp_expired', message: 'Token has expired' })).toBe('otp_expired');
    expect(errorCode({ message: 'must_be_18' })).toBe('must_be_18');
    expect(errorCode(new TypeError('Network request failed'))).toBe('network');
    expect(errorCode(null)).toBe('unknown');
  });

  it('unwraps PostgREST errors raised by RPC functions (code P0001, message is the real code)', () => {
    const rpc = (message: string) => ({ code: 'P0001', message, details: null, hint: null });
    expect(errorCode(rpc('must_be_18'))).toBe('must_be_18');
    expect(errorCode(rpc('username_taken'))).toBe('username_taken');
    expect(errorCode(rpc('already_onboarded'))).toBe('already_onboarded');
    expect(errorCode(new ApiError(errorCode(rpc('too_few_interests'))))).toBe('too_few_interests');
  });

  it('still reads other database codes as they are', () => {
    expect(errorCode({ code: '42501', message: 'permission denied' })).toBe('42501');
  });

  it('maps a raised RPC error all the way to friendly copy', () => {
    const rpc = (message: string) => ({ code: 'P0001', message });
    for (const code of ONBOARDING_ERROR_CODES) {
      expect(mapOnboardingError(errorCode(rpc(code)))).not.toBe(GENERIC_ERROR);
    }
    expect(onboardingStepForError(errorCode(rpc('username_taken')))).toBe('profile');
    expect(onboardingStepForError(errorCode(rpc('city_invalid')))).toBe('location');
  });
});

describe('mapFriendError', () => {
  it('has friendly copy for every friends error code', () => {
    for (const code of FRIEND_ERROR_CODES) {
      const copy = mapFriendError(code);
      expect(copy).not.toBe(GENERIC_ERROR);
      expect(copy).not.toContain('_');
    }
  });

  it('reads the code off a PostgREST P0001 error', () => {
    expect(mapFriendError(errorCode({ code: 'P0001', message: 'rate_limited' }))).toMatch(/too fast/);
  });

  it('never says "blocked" for user_not_found', () => {
    expect(mapFriendError('user_not_found')).not.toMatch(/block/i);
  });

  it('falls back to a generic message', () => {
    expect(mapFriendError('boom')).toBe(GENERIC_ERROR);
    expect(mapFriendError(undefined)).toBe(GENERIC_ERROR);
  });
});
