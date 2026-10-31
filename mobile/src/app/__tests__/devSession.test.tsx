import { render } from '@testing-library/react-native';

import DevSessionScreen from '../(auth)/dev-session';

const mockSignIn = jest.fn(() => Promise.resolve());
const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ rt: 'some-refresh-token' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
}));
jest.mock('@/lib/api', () => ({ api: { signInWithRefreshToken: () => mockSignIn() } }));

describe('yard://dev-session', () => {
  it('never signs anyone in unless the simulator build turned it on', async () => {
    // EXPO_PUBLIC_DEV_SESSION_LINK is unset here, as in every build people install.
    await render(<DevSessionScreen />);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/welcome' });
  });
});
