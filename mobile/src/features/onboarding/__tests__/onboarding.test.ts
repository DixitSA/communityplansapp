import { CHARLOTTE_CITY_ID } from '@/lib/api';

import { useOnboardingDraft } from '../draftStore';
import { draftToInput } from '../finish';
import { formatCountdown } from '../useCountdown';
import { deriveUsernameStatus } from '../useUsernameAvailability';

const idle = { isFetching: false, isError: false, data: undefined };

describe('deriveUsernameStatus', () => {
  it('is idle when empty', () => {
    expect(deriveUsernameStatus({ username: '', settled: '', query: idle })).toEqual({ kind: 'idle' });
  });

  it('reports format problems immediately, without waiting for the debounce', () => {
    expect(deriveUsernameStatus({ username: 'ab', settled: '', query: idle })).toEqual({
      kind: 'invalid',
      message: 'Use at least 3 characters.',
    });
  });

  it('is checking while typing settles or the request runs', () => {
    expect(deriveUsernameStatus({ username: 'maya', settled: 'may', query: idle }).kind).toBe('checking');
    expect(deriveUsernameStatus({ username: 'maya', settled: 'maya', query: { ...idle, isFetching: true } }).kind).toBe('checking');
    expect(deriveUsernameStatus({ username: 'maya', settled: 'maya', query: idle }).kind).toBe('checking');
  });

  it('shows the server answer once settled', () => {
    expect(deriveUsernameStatus({ username: 'maya', settled: 'maya', query: { ...idle, data: true } }).kind).toBe('available');
    expect(deriveUsernameStatus({ username: 'maya', settled: 'maya', query: { ...idle, data: false } }).kind).toBe('taken');
    expect(deriveUsernameStatus({ username: 'maya', settled: 'maya', query: { ...idle, isError: true } }).kind).toBe('error');
  });
});

describe('formatCountdown', () => {
  it('formats m:ss and never goes negative', () => {
    expect(formatCountdown(60)).toBe('1:00');
    expect(formatCountdown(42)).toBe('0:42');
    expect(formatCountdown(5)).toBe('0:05');
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(-3)).toBe('0:00');
  });
});

describe('onboarding draft', () => {
  beforeEach(() => useOnboardingDraft.getState().reset());

  it('prefills the name from Apple only when empty', () => {
    const s = useOnboardingDraft.getState();
    s.prefillDisplayName('  Taylor ');
    expect(useOnboardingDraft.getState().displayName).toBe('Taylor');
    s.setDisplayName('Tay');
    s.prefillDisplayName('Taylor');
    expect(useOnboardingDraft.getState().displayName).toBe('Tay');
    s.prefillDisplayName(null);
    expect(useOnboardingDraft.getState().displayName).toBe('Tay');
  });

  it('toggles interests and defaults the city to Charlotte', () => {
    const s = useOnboardingDraft.getState();
    s.toggleInterest(2);
    s.toggleInterest(5);
    s.toggleInterest(2);
    expect(useOnboardingDraft.getState().interestIds).toEqual([5]);
    expect(useOnboardingDraft.getState().homeCityId).toBe(CHARLOTTE_CITY_ID);
  });

  it('stores the birthday as a date-only string', () => {
    useOnboardingDraft.getState().setBirthdate(new Date(1995, 5, 15));
    expect(useOnboardingDraft.getState().birthdate).toBe('1995-06-15');
    useOnboardingDraft.getState().setBirthdate(null);
    expect(useOnboardingDraft.getState().birthdate).toBeNull();
  });
});

describe('draftToInput', () => {
  const today = new Date(2026, 9, 28);
  const full = {
    displayName: ' Maya ',
    username: 'maya.c',
    birthdate: '1995-06-15',
    interestIds: [1, 2, 3],
    homeCityId: CHARLOTTE_CITY_ID,
  };

  it('builds the RPC input from a complete draft', () => {
    expect(draftToInput(full, today)).toEqual({
      ok: true,
      input: {
        username: 'maya.c',
        displayName: 'Maya',
        birthdate: '1995-06-15',
        interestIds: [1, 2, 3],
        homeCityId: CHARLOTTE_CITY_ID,
      },
    });
  });

  it('sends people back to the incomplete step', () => {
    expect(draftToInput({ ...full, username: '' }, today)).toEqual({ ok: false, step: 'profile' });
    expect(draftToInput({ ...full, displayName: '' }, today)).toEqual({ ok: false, step: 'profile' });
    expect(draftToInput({ ...full, birthdate: null }, today)).toEqual({ ok: false, step: 'profile' });
    expect(draftToInput({ ...full, birthdate: '2015-01-01' }, today)).toEqual({ ok: false, step: 'profile' });
    expect(draftToInput({ ...full, interestIds: [1, 2] }, today)).toEqual({ ok: false, step: 'interests' });
  });
});
