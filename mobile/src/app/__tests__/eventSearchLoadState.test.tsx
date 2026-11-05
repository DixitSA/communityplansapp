import { fireEvent, render } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import SearchScreen from '../(tabs)/search';

const mockRefetchEvents = jest.fn();
let mockEvents: { upcoming: []; isLoading: boolean; isError: boolean; refetch: jest.Mock };

jest.mock('expo-router', () => ({ Stack: { Screen: () => null }, router: { push: jest.fn() } }));
jest.mock('@/features/feed/useFeedEvents', () => ({ useFeedEvents: () => mockEvents }));
jest.mock('@/features/friends/useFriendButton', () => ({ useFriendButton: () => ({ onAction: jest.fn(), busyId: null }) }));
jest.mock('@/features/friends/useFriends', () => ({ useFriendRequests: () => ({ data: [] }) }));
jest.mock('@/features/friends/useFriendSearch', () => ({ useFriendSearch: () => ({ status: 'idle', results: [], typed: '', refetch: jest.fn() }) }));
jest.mock('@/features/friends/invite', () => ({ inviteFriends: jest.fn() }));
jest.mock('@/lib/haptics', () => ({ selection: jest.fn() }));
jest.mock('@/design', () => {
  const React = jest.requireActual('react');
  const { Pressable, Text, TextInput, View } = jest.requireActual('react-native');
  return {
    AppText: ({ children }: { children: ReactNode }) => React.createElement(Text, null, children),
    Button: ({ label, onPress }: { label: string; onPress: () => void }) =>
      React.createElement(Pressable, { accessibilityRole: 'button', onPress }, React.createElement(Text, null, label)),
    Chip: () => React.createElement(View),
    EmptyState: ({ title, children }: { title: string; children?: ReactNode }) =>
      React.createElement(View, null, React.createElement(Text, null, title), children),
    FriendButton: () => React.createElement(View),
    NavRow: () => React.createElement(View),
    PersonRow: () => React.createElement(View),
    PersonRowSkeleton: () => React.createElement(View),
    SearchField: ({ value, onChangeText }: { value: string; onChangeText: (value: string) => void }) =>
      React.createElement(TextInput, { value, onChangeText, placeholder: 'Search events' }),
    SegmentedControl: () => React.createElement(View),
    useLargeTitleHeader: () => ({}),
    useTheme: () => ({ colors: { canvas: 'white' }, space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxxl: 48 } }),
  };
});

beforeEach(() => {
  mockRefetchEvents.mockReset();
  mockEvents = { upcoming: [], isLoading: false, isError: false, refetch: mockRefetchEvents };
});

it('shows a loading state while event search data is pending', async () => {
  mockEvents.isLoading = true;
  const { getByPlaceholderText, getByText, queryByText } = await render(<SearchScreen />);
  await fireEvent.changeText(getByPlaceholderText('Search events'), 'jazz');
  expect(getByText('Loading events…')).toBeTruthy();
  expect(queryByText('no events found')).toBeNull();
});

it('shows an error retry instead of the no-results state when event loading fails', async () => {
  mockEvents.isError = true;
  const { getByPlaceholderText, getByText, queryByText } = await render(<SearchScreen />);
  await fireEvent.changeText(getByPlaceholderText('Search events'), 'jazz');
  expect(getByText('couldn’t load events')).toBeTruthy();
  expect(queryByText('no events found')).toBeNull();
  await fireEvent.press(getByText('Try again'));
  expect(mockRefetchEvents).toHaveBeenCalledTimes(1);
});
