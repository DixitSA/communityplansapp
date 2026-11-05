import { render, waitFor } from '@testing-library/react-native';

import DevSessionScreen from '../(auth)/dev-session';

let mockToken: string | undefined = 'some-refresh-token';
const mockSignIn = jest.fn((_token?: string) => Promise.resolve());
const mockRedirect = jest.fn((_props: { href: string }) => null);

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ rt: mockToken }),
  Redirect: (props: { href: string }) => mockRedirect(props),
}));
jest.mock('@/lib/api', () => ({ api: { signInWithRefreshToken: (token: string) => mockSignIn(token) } }));
jest.mock('@/lib/env', () => ({ devSessionLinkEnabled: true }));

describe('enabled simulator dev-session link', () => {
  beforeEach(() => {
    mockToken = 'some-refresh-token';
    mockSignIn.mockReset();
    mockSignIn.mockResolvedValue(undefined);
    mockRedirect.mockClear();
  });

  it('redirects when the refresh token is missing', async () => {
    mockToken = undefined;
    await render(<DevSessionScreen />);
    expect(mockSignIn).not.toHaveBeenCalled();
    expect(mockRedirect).toHaveBeenCalledWith({ href: '/welcome' });
  });

  it('shows an error for an invalid token without calling a real API', async () => {
    mockSignIn.mockRejectedValueOnce(new Error('invalid refresh token'));
    const view = await render(<DevSessionScreen />);
    await waitFor(() => expect(view.queryByText('That sign-in link didn’t work')).toBeTruthy());
    expect(mockSignIn).toHaveBeenCalledTimes(1);
    expect(mockSignIn).toHaveBeenCalledWith('some-refresh-token');
  });
});
