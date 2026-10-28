import { renderRouter, screen } from 'expo-router/testing-library';

// expo-router's test harness swaps in its own Reanimated mock, which has no hooks, so skip the
// animated components these routes render (the profile tab's loading skeleton and the welcome blob).
jest.mock('@/design/components/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/features/onboarding/WelcomeBlob', () => ({ WelcomeBlob: () => null }));

// Regression: on iOS the app opened to a blank screen because two files claimed "/".
describe('app routing', () => {
  it('opens on the Feed', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Find your people.')).toBeTruthy();
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
