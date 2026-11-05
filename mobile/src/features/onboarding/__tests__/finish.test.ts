import { api } from '@/lib/api';

import { useOnboardingDraft } from '../draftStore';
import { finishOnboarding } from '../finish';

jest.mock('@/lib/api', () => ({
  ...jest.requireActual('@/lib/api/errors'),
  CHARLOTTE_CITY_ID: 1,
  api: { completeOnboarding: jest.fn(), setMyAvatar: jest.fn() },
}));

const mock = api as unknown as Record<'completeOnboarding' | 'setMyAvatar', jest.Mock>;

beforeEach(() => {
  jest.resetAllMocks();
  useOnboardingDraft.getState().reset();
  useOnboardingDraft.setState({
    displayName: 'Maya', username: 'maya', birthdate: '1995-06-15', interestIds: [1, 2, 3],
    photoUri: 'file:///maya.jpg',
  });
});

it('creates the profile before uploading and refreshes before releasing onboarding', async () => {
  const order: string[] = [];
  mock.completeOnboarding.mockImplementation(async () => {
    expect(useOnboardingDraft.getState().completionPending).toBe(true);
    order.push('profile');
  });
  mock.setMyAvatar.mockImplementation(async (uri: string) => {
    expect(uri).toBe('file:///maya.jpg');
    order.push('photo');
  });
  const refresh = jest.fn(async () => {
    expect(useOnboardingDraft.getState().completionPending).toBe(true);
    order.push('refresh');
  });
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'success' });
  expect(order).toEqual(['profile', 'photo', 'refresh']);
  expect(useOnboardingDraft.getState().photoUri).toBeNull();
  expect(useOnboardingDraft.getState().completionPending).toBe(false);
});

it('keeps the photo after upload failure and retries without creating the profile twice', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  mock.setMyAvatar.mockRejectedValueOnce(new Error('offline'));
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'photo-error' });
  expect(refresh).not.toHaveBeenCalled();
  expect(useOnboardingDraft.getState().completionPending).toBe(true);
  expect(useOnboardingDraft.getState().photoUri).toBe('file:///maya.jpg');
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'success' });
  expect(mock.completeOnboarding).toHaveBeenCalledTimes(1);
  expect(mock.setMyAvatar).toHaveBeenCalledTimes(2);
});

it('can continue after a photo failure without retrying its upload', async () => {
  const refresh = jest.fn().mockResolvedValue(undefined);
  mock.setMyAvatar.mockRejectedValueOnce(new Error('offline'));
  await finishOnboarding(refresh);
  expect(await finishOnboarding(refresh, true)).toEqual({ kind: 'success' });
  expect(mock.completeOnboarding).toHaveBeenCalledTimes(1);
  expect(mock.setMyAvatar).toHaveBeenCalledTimes(1);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(useOnboardingDraft.getState().photoUri).toBeNull();
});

it('does not upload when no photo was chosen', async () => {
  useOnboardingDraft.getState().setPhotoUri(null);
  expect(await finishOnboarding(jest.fn().mockResolvedValue(undefined))).toEqual({ kind: 'success' });
  expect(mock.setMyAvatar).not.toHaveBeenCalled();
});

it('resumes photo upload when the server says the profile already exists', async () => {
  mock.completeOnboarding.mockRejectedValueOnce({ code: 'P0001', message: 'already_onboarded' });
  const refresh = jest.fn().mockResolvedValue(undefined);
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'success' });
  expect(mock.setMyAvatar).toHaveBeenCalledWith('file:///maya.jpg', undefined);
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('retains progress on refresh failure and does not re-upload a saved photo', async () => {
  const refresh = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'error', code: 'offline' });
  expect(useOnboardingDraft.getState().completionPending).toBe(true);
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'success' });
  expect(mock.completeOnboarding).toHaveBeenCalledTimes(1);
  expect(mock.setMyAvatar).toHaveBeenCalledTimes(1);
});

it('remembers the choice to skip the photo when the final refresh needs a retry', async () => {
  const refresh = jest.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined);
  await finishOnboarding(refresh, true);
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'success' });
  expect(mock.setMyAvatar).not.toHaveBeenCalled();
});

it('does not upload or change a new draft if the account changes during profile creation', async () => {
  mock.completeOnboarding.mockImplementation(async () => {
    useOnboardingDraft.getState().reset();
    useOnboardingDraft.getState().setDisplayName('New person');
  });
  const refresh = jest.fn();
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'cancelled' });
  expect(mock.setMyAvatar).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(useOnboardingDraft.getState().displayName).toBe('New person');
});

it('prevents duplicate submissions while profile creation is in flight', async () => {
  let resolve: () => void = () => {};
  mock.completeOnboarding.mockReturnValue(new Promise<void>((done) => { resolve = done; }));
  const refresh = jest.fn().mockResolvedValue(undefined);
  const first = finishOnboarding(refresh);
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'cancelled' });
  resolve();
  expect(await first).toEqual({ kind: 'success' });
  expect(mock.completeOnboarding).toHaveBeenCalledTimes(1);
});

it('stops before upload and refresh when profile creation fails', async () => {
  mock.completeOnboarding.mockRejectedValueOnce({ code: 'P0001', message: 'username_taken' });
  const refresh = jest.fn();
  expect(await finishOnboarding(refresh)).toEqual({ kind: 'error', code: 'username_taken' });
  expect(mock.setMyAvatar).not.toHaveBeenCalled();
  expect(refresh).not.toHaveBeenCalled();
  expect(useOnboardingDraft.getState().submissionBusy).toBe(false);
});
