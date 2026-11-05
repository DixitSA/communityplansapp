import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import SuggestSheet from '../suggest';
import EditProfileSheet from '../edit-profile';
import VerifyScreen from '../(auth)/verify';
import { api, type MyProfile } from '@/lib/api';

// Cold React Native screen initialization can exceed Jest's default timeout in CI.
jest.setTimeout(30_000);

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  useLocalSearchParams: () => ({ email: 'maya@example.com' }),
}));

jest.mock('@/features/profile/useMyProfile', () => ({
  MY_PROFILE_KEY: 'my-profile',
  useMyProfile: () => ({ data: mockProfile, isPending: false, isError: false, refetch: jest.fn() }),
}));

jest.mock('@/features/onboarding/useUsernameAvailability', () => ({
  useUsernameAvailability: () => ({ kind: 'available' }),
}));

jest.mock('@/features/onboarding/useCountdown', () => ({
  formatCountdown: (seconds: number) => `${seconds}`,
  useCountdown: () => ({ remaining: 0, restart: mockRestartCountdown }),
}));

jest.mock('@/features/auth/useSignInFlow', () => ({ useSignInFlow: () => ({ afterSignIn: jest.fn() }) }));
jest.mock('@/features/onboarding/Scaffold', () => ({
  Scaffold: ({ children }: { children: ReactNode }) => <>{children}</>,
}));
jest.mock('@/features/submit/DateTimeField', () => ({
  DateTimeField: ({ onChange }: { onChange: (date: Date) => void }) => {
    const { Pressable, Text } = jest.requireActual('react-native');
    return (
      <Pressable onPress={() => onChange(new Date(Date.now() + 86_400_000))}>
        <Text>Set date</Text>
      </Pressable>
    );
  },
}));
jest.mock('@/lib/haptics', () => ({ success: jest.fn(), warning: jest.fn(), light: jest.fn(), selection: jest.fn() }));

const mockProfile: MyProfile = {
  id: 'u1',
  username: 'maya',
  displayName: 'Maya',
  homeCityId: 1,
  bio: null,
  interests: [1, 2, 3].map((id) => ({ id, slug: `i${id}`, label: `Interest ${id}`, symbol: 'star' })),
};
const mockRestartCountdown = jest.fn();
const cleanups: (() => Promise<void>)[] = [];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function withQueryClient(node: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false, gcTime: Infinity } } });
  client.setQueryData(['interests'], mockProfile.interests);
  const ui = await render(<QueryClientProvider client={client}>{node}</QueryClientProvider>);
  cleanups.push(async () => { await ui.unmount(); client.clear(); });
  return ui;
}

describe('submission race regressions', () => {
  afterEach(async () => {
    await Promise.all(cleanups.splice(0).map((cleanup) => cleanup()));
    jest.restoreAllMocks();
    mockRestartCountdown.mockClear();
  });

  it('keeps the profile save pending and prevents duplicate saves while the deferred API request is in flight', async () => {
    const request = deferred<void>();
    const update = jest.spyOn(api, 'updateMyProfile').mockReturnValue(request.promise);
    const ui = await withQueryClient(<EditProfileSheet />);
    await fireEvent.changeText(ui.getByLabelText('Name'), 'Updated Maya');
    const user = userEvent.setup();
    // User events finish the native press sequence without awaiting the network
    // request returned by onPress, so the next actions happen while it is pending.
    await user.press(ui.getByLabelText('Save'));
    await waitFor(() => expect(update).toHaveBeenCalledTimes(1));
    expect(ui.getByLabelText('Saving your profile').props.accessibilityState.disabled).toBe(true);
    expect(ui.getByLabelText('Cancel').props.accessibilityState.disabled).toBe(true);
    expect(ui.getByLabelText('Name').props.editable).toBe(false);
    await fireEvent.changeText(ui.getByLabelText('Name'), 'Late edit');
    await user.press(ui.getByLabelText('Saving your profile'));
    expect(ui.getByLabelText('Name').props.value).toBe('Updated Maya');
    expect(update).toHaveBeenCalledTimes(1);
    await act(async () => { request.resolve(); });
    await ui.unmount();
  });

  it('does not allow a second event suggestion while the first is pending and fields are edited', async () => {
    const request = deferred<string>();
    const submit = jest.spyOn(api, 'submitEvent').mockReturnValue(request.promise);
    const ui = await withQueryClient(<SuggestSheet />);

    await fireEvent.changeText(ui.getByLabelText('Title'), 'Night market');
    await fireEvent.press(ui.getByText('Set date'));
    const user = userEvent.setup();
    await user.press(ui.getByLabelText('Send suggestion'));
    await waitFor(() => expect(submit).toHaveBeenCalledTimes(1));

    await fireEvent.changeText(ui.getByLabelText('Title'), 'Updated night market');
    const sending = ui.getByLabelText('Sending your suggestion');
    expect(sending.props.accessibilityState.disabled).toBe(true);
    await act(async () => request.resolve('submission-id'));
    await ui.unmount();
  });

  it('ignores repeated resend taps until the current email request settles', async () => {
    const request = deferred<void>();
    const send = jest.spyOn(api, 'sendEmailCode').mockReturnValue(request.promise);
    const ui = await render(<VerifyScreen />);
    cleanups.push(ui.unmount);

    const resend = ui.getByLabelText('Resend code');
    const user = userEvent.setup();
    await user.press(resend);
    await user.press(resend);
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));
    await act(async () => request.resolve());
    expect(mockRestartCountdown).toHaveBeenCalledTimes(1);
    await ui.unmount();
  });
});
