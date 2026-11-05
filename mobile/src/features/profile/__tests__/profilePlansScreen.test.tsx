import { fireEvent, render, screen } from '@testing-library/react-native';

import ProfileScreen from '@/app/(tabs)/profile';
import { useMyPlans } from '../useMyPlans';

jest.mock('expo-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => children,
  Stack: { Screen: () => null },
  router: { push: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => ({}),
}));
jest.mock('@/design', () => ({ ...jest.requireActual('@/design'), useLargeTitleHeader: () => ({}) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock('../useMyPlans', () => ({ useMyPlans: jest.fn() }));
jest.mock('../useMyProfile', () => ({
  useMyProfile: () => ({ data: { displayName: 'Test', username: 'test', interests: [] }, isPending: false, isError: false }),
}));
jest.mock('@/features/friends/useFriends', () => ({ useFriends: () => ({ data: [] }), useFriendRequests: () => ({ data: [] }) }));
jest.mock('@/features/event/demoPlans', () => ({ useDemoPlans: () => {} }));
jest.mock('@/features/feed/useSuggestedEvents', () => ({ useSuggestedEvents: () => ({ events: [] }) }));
jest.mock('@/features/feed/SuggestedEvents', () => ({ SuggestedEvents: () => null }));
jest.mock('../PlanTicket', () => ({ PlanTicket: () => null }));
jest.mock('@/lib/env', () => ({ isBackendConfigured: true }));

const plans = jest.mocked(useMyPlans);
const refetch = jest.fn();
function state(overrides: Record<string, unknown> = {}) {
  plans.mockReturnValue({ data: undefined, isPending: false, isError: false, refetch, ...overrides } as unknown as ReturnType<typeof useMyPlans>);
}
beforeEach(() => { jest.clearAllMocks(); state(); });

it('shows loading in both plan sections without claiming the lists are empty', async () => {
  state({ isPending: true });
  await render(<ProfileScreen />);
  expect(screen.getByLabelText('Loading your plans')).toBeTruthy();
  expect(screen.getByLabelText('Loading interested events')).toBeTruthy();
  expect(screen.queryByText(/Nothing on your calendar yet/)).toBeNull();
  expect(screen.queryByText(/Tap ♡ Interested on an event/)).toBeNull();
  expect(screen.queryByLabelText('0 Upcoming')).toBeNull();
});

it('offers recovery in both sections after a failed fetch, without false empty states', async () => {
  state({ isError: true });
  await render(<ProfileScreen />);
  expect(screen.getByText('Couldn’t load your plans.')).toBeTruthy();
  expect(screen.getByText('Couldn’t load your interested events.')).toBeTruthy();
  expect(screen.queryByText(/Nothing on your calendar yet/)).toBeNull();
  expect(screen.queryByText(/Tap ♡ Interested on an event/)).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Retry plans' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Retry interested events' }));
  expect(refetch).toHaveBeenCalledTimes(2);
});

it('shows the empty guidance only after a successful empty response', async () => {
  state({ data: [] });
  await render(<ProfileScreen />);
  expect(screen.getByText(/Nothing on your calendar yet/)).toBeTruthy();
  expect(screen.getByText(/Tap ♡ Interested on an event/)).toBeTruthy();
});
