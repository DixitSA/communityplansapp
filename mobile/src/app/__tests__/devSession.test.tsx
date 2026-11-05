import { render } from '@testing-library/react-native';

import DevSessionScreen from '../(auth)/dev-session';

const mockSignIn = jest.fn(() => Promise.resolve());
const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ rt: 'some-refresh-token' }),
  Redirect: (props: { href: string }) => mockRedirect(props),
}));
jest.mock('@/lib/api', () => ({ api: { signInWithRefreshToken: () => mockSignIn() } }));
jest.mock('@/lib/env', () => ({ devSessionLinkEnabled: false }));

describe('yard://dev-session', () => {
  it('redirects without signing in when the simulator link is disabled', async () => {
    await render(<DevSessionScreen />);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/welcome' });
  });
});
