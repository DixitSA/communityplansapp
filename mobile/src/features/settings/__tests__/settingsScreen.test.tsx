import { fireEvent, render, screen } from '@testing-library/react-native';

import SettingsSheet from '@/app/settings';
import { useDiscoverableByPhone } from '../useSettings';

jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), push: jest.fn() }) }));
jest.mock('../useSettings', () => ({
  useDiscoverableByPhone: jest.fn(),
  useDeleteAccount: () => ({ isPending: false }),
}));
jest.mock('@/features/submit/MySuggestions', () => ({ MySuggestions: () => null }));
jest.mock('@/features/submit/SuggestRow', () => ({ SuggestRow: () => null }));
jest.mock('@/lib/api', () => ({ api: {} }));
jest.mock('@/lib/env', () => ({ isBackendConfigured: false }));
jest.mock('@/lib/haptics', () => ({ selection: jest.fn(), warning: jest.fn() }));

const discoverable = jest.mocked(useDiscoverableByPhone);
const retry = jest.fn();
const set = jest.fn();

function state(overrides: Record<string, unknown> = {}) {
  discoverable.mockReturnValue({
    value: false, isLoading: false, isPending: false, isReadError: false,
    error: false, retry, set, ...overrides,
  } as ReturnType<typeof useDiscoverableByPhone>);
}

beforeEach(() => { jest.clearAllMocks(); state(); });

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
