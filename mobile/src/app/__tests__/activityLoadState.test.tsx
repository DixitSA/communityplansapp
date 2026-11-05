import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import ActivityScreen from '../activity';

const mockRefetch = jest.fn();
let mockRequests: { data: undefined; isPending: boolean; isError: boolean; refetch: jest.Mock };

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn(), navigate: jest.fn() } }));
jest.mock('@/lib/env', () => ({ isBackendConfigured: true }));
jest.mock('@/lib/useNow', () => ({ useNow: () => new Date('2026-11-04T12:00:00Z') }));
jest.mock('@/features/activity/fixtures', () => ({ getActivityItems: () => [] }));
jest.mock('@/features/friends/useFriends', () => ({ useFriendRequests: () => mockRequests }));
jest.mock('@/features/friends/useFriendAction', () => ({ alertFriendFailure: jest.fn(), useFriendAction: () => ({ run: jest.fn(), busyId: null }) }));
jest.mock('@/design', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, View } = jest.requireActual('react-native');
  return {
    AppText: ({ children }: { children: ReactNode }) => React.createElement(Text, null, children),
    Avatar: () => React.createElement(View),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityRole: 'button', onPress }, React.createElement(Text, null, label)),
    Chip: () => React.createElement(View),
    EmptyState: ({ title, children }: { title: string; children?: ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
    useTheme: () => ({ colors: { canvas: 'white' }, space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxxl: 48 }, radius: { sheet: 20 } }),
  };
});

beforeEach(() => {
  mockRefetch.mockReset();
  mockRequests = { data: undefined, isPending: false, isError: false, refetch: mockRefetch };
});

it('shows a loading state while incoming requests are pending', async () => {
  mockRequests.isPending = true;
  const { getByText, queryByText } = await render(<ActivityScreen />);
  expect(getByText('Loading friend requests…')).toBeTruthy();
  expect(queryByText('nothing here yet')).toBeNull();
});

it('shows an error retry instead of the empty state when requests fail', async () => {
  mockRequests.isError = true;
  const { getByText, queryByText } = await render(<ActivityScreen />);
  expect(getByText('couldn’t load activity')).toBeTruthy();
  expect(queryByText('nothing here yet')).toBeNull();
  await fireEvent.press(getByText('Try again'));
  expect(mockRefetch).toHaveBeenCalledTimes(1);
});
