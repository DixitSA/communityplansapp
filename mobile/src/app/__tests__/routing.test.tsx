import { renderRouter, screen } from 'expo-router/testing-library';

// The first renderRouter in a file loads every route module, which takes ~2.5s on an idle machine
// and over 5s (Jest's default test timeout) when the machine is busy. Later renders take ~0.1s.
jest.setTimeout(30_000);

// expo-router's test harness swaps in its own Reanimated mock, which has no hooks, so skip the
// animated components these routes render (the profile tab's loading skeleton and the welcome blob).
jest.mock('@/design/components/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/features/onboarding/WelcomeBlob', () => ({ WelcomeBlob: () => null }));

// Regression: on iOS the app opened to a blank screen because two files claimed "/".
describe('app routing', () => {
  it('opens on the Feed', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Nearby')).toBeTruthy();
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
