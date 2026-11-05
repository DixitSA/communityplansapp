import { renderRouter, screen } from 'expo-router/testing-library';
import { Text } from 'react-native';

let mockGate: 'app' | 'demo' = 'demo';
const originalDevDescriptor = Object.getOwnPropertyDescriptor(globalThis, '__DEV__');

jest.setTimeout(60_000);
jest.mock('@/design/components/Skeleton', () => ({ Skeleton: () => null }));
jest.mock('@/design/usePressScale', () => ({
  usePressScale: () => ({ style: undefined, handlers: {} }),
  PressScaleView: jest.requireActual('react-native').View,
}));
jest.mock('@/design/components/EmptyState', () => ({ EmptyState: () => null }));
jest.mock('@/features/onboarding/WelcomeBlob', () => ({ WelcomeBlob: () => null }));
jest.mock('@/features/auth/useGate', () => ({
  useGate: () => ({ gate: mockGate, profile: { isError: false, refetch: jest.fn() } }),
}));

function renderApp(initialUrl: string) {
  return renderRouter(
    {
      appDir: './src/app',
      overrides: { '(dev)/gallery': () => <Text>Gallery</Text> },
    },
    { initialUrl },
  );
}

function setDevBuild(isDev: boolean) {
  Object.defineProperty(globalThis, '__DEV__', { configurable: true, value: isDev });
}

afterEach(() => {
  mockGate = 'demo';
  if (originalDevDescriptor) Object.defineProperty(globalThis, '__DEV__', originalDevDescriptor);
});

describe('developer gallery route', () => {
  it('allows a direct link in development', async () => {
    mockGate = 'app';
    setDevBuild(true);
    const development = await renderApp('/gallery');
    expect(await screen.findByText('Gallery')).toBeTruthy();
    development.unmount();
  });

  it('redirects a direct link to the Feed in production', async () => {
    mockGate = 'app';
    setDevBuild(false);
    const production = await renderApp('/gallery');
    expect(await screen.findByLabelText('Nearby')).toBeTruthy();
    expect(screen.queryByText('Gallery')).toBeNull();
    production.unmount();
  });
});
