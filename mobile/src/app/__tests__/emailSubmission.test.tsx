import { act, fireEvent, render, userEvent, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import EmailScreen from '../(auth)/email';
import WelcomeScreen from '../(auth)/welcome';
import { api } from '@/lib/api';

const mockRouter = { back: jest.fn(), push: jest.fn() };
const mockAfterSignIn = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => mockRouter }));
jest.mock('@/features/auth/useSignInFlow', () => ({ useSignInFlow: () => ({ afterSignIn: mockAfterSignIn }) }));
jest.mock('@/features/onboarding/WelcomeBlob', () => ({ WelcomeBlob: () => null }));
jest.mock('@/features/onboarding/AppleSignInButton', () => ({
  AppleSignInButton: ({ onPress }: { onPress: () => void }) => {
    const { Pressable } = jest.requireActual('react-native');
    // Models AppleAuthenticationButton.ios.tsx: disabled only dims its style, it does not disable input.
    return <Pressable accessibilityRole="button" accessibilityLabel="Sign in with Apple" onPress={onPress} />;
  },
}));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe('email sign-in submission', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    mockAfterSignIn.mockClear();
    mockRouter.back.mockClear();
    mockRouter.push.mockClear();
  });

  it('does not navigate to Verify after Back dismisses a pending send', async () => {
    const request = deferred<void>();
    const send = jest.spyOn(api, 'sendEmailCode').mockReturnValue(request.promise);
    const ui = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>
        <EmailScreen />
      </SafeAreaProvider>,
    );

    await fireEvent.changeText(ui.getByTestId('email-input'), 'maya@example.com');
    const user = userEvent.setup();
    const sending = user.press(ui.getByRole('button', { name: 'Send code' }));
    await waitFor(() => expect(send).toHaveBeenCalledTimes(1));

    await user.press(ui.getByLabelText('Back'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    await ui.unmount();

    await act(async () => request.resolve());
    await sending;

    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('ignores a second Apple sign-in tap while the first native request is pending', async () => {
    const request = deferred<{ givenName: string }>();
    const signIn = jest.spyOn(api, 'signInWithApple').mockReturnValue(request.promise);
    const ui = await render(
      <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, right: 0, bottom: 0, left: 0 } }}>
        <WelcomeScreen />
      </SafeAreaProvider>,
    );
    const user = userEvent.setup();
    const apple = ui.getByRole('button', { name: 'Sign in with Apple' });

    await user.press(apple);
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    await user.press(apple);
    expect(signIn).toHaveBeenCalledTimes(1);

    request.resolve({ givenName: 'Maya' });
    await waitFor(() => expect(mockAfterSignIn).toHaveBeenCalledTimes(1));
    await ui.unmount();
  });
});
