import { renderRouter, screen } from 'expo-router/testing-library';

// renderRouter imports the full route graph; cold render measured 16.3s on Windows.
jest.setTimeout(30_000);

// expo-router's test harness swaps in its own Reanimated mock, which has no hooks, so skip the
// animated components these routes render (the profile tab's loading skeleton and the welcome blob).
jest.mock('@/design/components/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/design/usePressScale', () => ({
  usePressScale: () => ({ style: undefined, handlers: {} }),
  PressScaleView: jest.requireActual('react-native').View,
}));
jest.mock('@/design/components/EmptyState', () => ({ EmptyState: () => null }));
jest.mock('@/features/onboarding/WelcomeBlob', () => ({ WelcomeBlob: () => null }));

// Regression: on iOS the app opened to a blank screen because two files claimed "/".
describe('app routing', () => {
  it('opens on the Feed', async () => {
    const result = await renderRouter('./src/app', { initialUrl: '/' });
    expect(result.getByLabelText('Nearby')).toBeTruthy();
  });

  // Demo mode (no Supabase keys in tests): every onboarding screen is open for screenshots.
  it.each([
    ['/welcome', 'Continue with email'],
    ['/email', 'Send code'],
    ['/onboarding/location', 'Just Charlotte'],
  ])('opens %s directly in demo mode', async (url, text) => {
    await renderRouter('./src/app', { initialUrl: url });
    expect(await screen.findByText(text)).toBeTruthy();
  });
});
