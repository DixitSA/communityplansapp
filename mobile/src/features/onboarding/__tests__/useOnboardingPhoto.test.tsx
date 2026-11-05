import { act, renderHook } from '@testing-library/react-native';

import { pickProfilePhoto } from '../../profile/useMyAvatar';
import { useOnboardingDraft } from '../draftStore';
import { useOnboardingPhoto } from '../useOnboardingPhoto';

jest.mock('../../profile/useMyAvatar', () => ({ pickProfilePhoto: jest.fn() }));
jest.mock('@/lib/api', () => ({ CHARLOTTE_CITY_ID: 1 }));
const pick = jest.mocked(pickProfilePhoto);

beforeEach(() => {
  jest.resetAllMocks();
  useOnboardingDraft.getState().reset();
});

it('chooses, changes and removes a photo locally', async () => {
  pick.mockResolvedValueOnce('file:///first.jpg').mockResolvedValueOnce('file:///second.jpg');
  const { result } = await renderHook(() => useOnboardingPhoto());
  await act(async () => { await result.current.choosePhoto(); });
  expect(useOnboardingDraft.getState().photoUri).toBe('file:///first.jpg');
  await act(async () => { await result.current.choosePhoto(); });
  expect(useOnboardingDraft.getState().photoUri).toBe('file:///second.jpg');
  await act(async () => { result.current.removePhoto(); });
  expect(useOnboardingDraft.getState().photoUri).toBeNull();
});

it('leaves the existing choice alone when the picker is cancelled or fails, and allows retry', async () => {
  useOnboardingDraft.getState().setPhotoUri('file:///existing.jpg');
  pick.mockResolvedValueOnce(null).mockRejectedValueOnce(new Error('unavailable')).mockResolvedValueOnce('file:///retry.jpg');
  const { result } = await renderHook(() => useOnboardingPhoto());
  await act(async () => { await result.current.choosePhoto(); });
  expect(useOnboardingDraft.getState().photoUri).toBe('file:///existing.jpg');
  expect(result.current.problem).toBeNull();
  await act(async () => { await result.current.choosePhoto(); });
  expect(result.current.problem).toContain('Couldn’t open your photos');
  expect(result.current.isPicking).toBe(false);
  expect(useOnboardingDraft.getState().photoUri).toBe('file:///existing.jpg');
  await act(async () => { await result.current.choosePhoto(); });
  expect(useOnboardingDraft.getState().photoUri).toBe('file:///retry.jpg');
  expect(result.current.problem).toBeNull();
});

it('ignores the picker result if the account changes while it is open', async () => {
  let resolve: (uri: string) => void = () => {};
  pick.mockReturnValue(new Promise((done) => { resolve = done; }));
  const { result } = await renderHook(() => useOnboardingPhoto());
  let pending: Promise<void> = Promise.resolve();
  await act(async () => { pending = result.current.choosePhoto(); });
  expect(result.current.isPicking).toBe(true);
  useOnboardingDraft.getState().reset();
  await act(async () => { resolve('file:///old-person.jpg'); await pending; });
  expect(useOnboardingDraft.getState().photoUri).toBeNull();
});
