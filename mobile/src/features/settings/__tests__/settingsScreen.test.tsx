import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import SettingsSheet from '@/app/settings';
import { api } from '@/lib/api';
import { useDeleteAccount, useDiscoverableByPhone } from '../useSettings';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../useSettings', () => ({
  useDiscoverableByPhone: jest.fn(),
  useDeleteAccount: jest.fn(),
}));
jest.mock('@/features/submit/MySuggestions', () => ({ MySuggestions: () => null }));
jest.mock('@/features/submit/SuggestRow', () => ({ SuggestRow: () => null }));
jest.mock('@/lib/api', () => ({ api: { signOut: jest.fn() } }));
jest.mock('@/lib/env', () => ({ isBackendConfigured: true }));
jest.mock('@/lib/haptics', () => ({ selection: jest.fn(), warning: jest.fn() }));

const discoverable = jest.mocked(useDiscoverableByPhone);
const deleteAccount = { isPending: false, mutate: jest.fn() };
const mutateDelete = jest.mocked(deleteAccount.mutate);
const signOut = jest.mocked(api.signOut);
const retry = jest.fn();
const set = jest.fn();

function state(overrides: Record<string, unknown> = {}) {
  discoverable.mockReturnValue({
    value: false, isLoading: false, isPending: false, isReadError: false,
    error: false, retry, set, ...overrides,
  } as ReturnType<typeof useDiscoverableByPhone>);
}

beforeEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  deleteAccount.isPending = false;
  jest.mocked(useDeleteAccount).mockReturnValue(deleteAccount as unknown as ReturnType<typeof useDeleteAccount>);
  signOut.mockResolvedValue(undefined);
  state();
});

function alertButtons(title: string) {
  const call = jest.mocked(Alert.alert).mock.calls.filter(([alertTitle]) => alertTitle === title).at(-1);
  return call?.[2] ?? [];
}

async function chooseAlertButton(title: string, label: string) {
  const button = alertButtons(title).find(({ text }) => text === label);
  if (!button) throw new Error(`Missing “${label}” button in “${title}” alert`);
  await act(async () => button.onPress?.());
}

function spyOnAlerts() {
  return jest.spyOn(Alert, 'alert').mockImplementation(() => {});
}

it('does not offer an enabled/default-true privacy switch when reading the preference fails', async () => {
  state({ value: undefined, isReadError: true });
  await render(<SettingsSheet />);
  expect(screen.queryByRole('switch')).toBeNull();
  expect(screen.getByText('Couldn’t load your privacy setting.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry privacy setting' }));
  expect(retry).toHaveBeenCalledTimes(1);
});

it('keeps the switch unavailable while loading and while saving', async () => {
  state({ value: undefined, isLoading: true });
  const view = await render(<SettingsSheet />);
  expect(screen.queryByRole('switch')).toBeNull();
  expect(screen.getByText('Loading privacy setting…')).toBeTruthy();
  state({ value: true, isPending: true });
  await view.rerender(<SettingsSheet />);
  expect(screen.getByRole('switch')).toBeDisabled();
});

it('explains a failed save beside the restored choice', async () => {
  state({ value: false, error: true });
  await render(<SettingsSheet />);
  expect(screen.getByText('Couldn’t save your choice. Check your connection and try again.')).toBeTruthy();
  expect(screen.getByRole('switch')).not.toBeChecked();
});

it('does not delete when either account deletion confirmation is cancelled', async () => {
  spyOnAlerts();
  await render(<SettingsSheet />);

  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  await chooseAlertButton('Delete your account?', 'Cancel');
  expect(mutateDelete).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  await chooseAlertButton('Delete your account?', 'Continue');
  await chooseAlertButton('Delete account for good?', 'Cancel');
  expect(mutateDelete).not.toHaveBeenCalled();
});

it('deletes only after the final confirmation and disables the action while pending', async () => {
  spyOnAlerts();
  const view = await render(<SettingsSheet />);
  mutateDelete.mockImplementation(() => {
    deleteAccount.isPending = true;
  });

  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  await chooseAlertButton('Delete your account?', 'Continue');
  expect(mutateDelete).not.toHaveBeenCalled();
  await chooseAlertButton('Delete account for good?', 'Delete my account');
  expect(mutateDelete).toHaveBeenCalledTimes(1);
  expect(mutateDelete).toHaveBeenCalledWith(undefined, expect.objectContaining({ onError: expect.any(Function) }));

  await view.rerender(<SettingsSheet />);
  expect(screen.getByRole('button', { name: 'Delete account' })).toBeDisabled();
  expect(screen.getByText('Deleting…')).toBeTruthy();
});

it('shows a delete error and allows another deletion attempt', async () => {
  const alert = spyOnAlerts();
  await render(<SettingsSheet />);
  mutateDelete.mockImplementationOnce((_value, options) => {
    options?.onError?.(new Error('delete failed'), undefined, undefined, undefined);
  });

  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  await chooseAlertButton('Delete your account?', 'Continue');
  await chooseAlertButton('Delete account for good?', 'Delete my account');
  expect(alert).toHaveBeenCalledWith(
    'Couldn’t delete your account',
    'Nothing was deleted. Check your connection and try again.',
  );

  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
  await chooseAlertButton('Delete your account?', 'Continue');
  await chooseAlertButton('Delete account for good?', 'Delete my account');
  expect(mutateDelete).toHaveBeenCalledTimes(2);
});

it('keeps sign out cancelled until confirmed and explains a failed sign out', async () => {
  const alert = spyOnAlerts();
  await render(<SettingsSheet />);

  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await chooseAlertButton('Sign out of yard?', 'Cancel');
  expect(signOut).not.toHaveBeenCalled();

  signOut.mockRejectedValueOnce(new Error('sign out failed'));
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  await act(async () => {
    await alertButtons('Sign out of yard?').find(({ text }) => text === 'Sign out')?.onPress?.();
    await Promise.resolve();
  });
  expect(signOut).toHaveBeenCalledTimes(1);
  expect(alert).toHaveBeenCalledWith('Couldn’t sign out', 'Check your connection and try again.');
});
