import { renderRouter, screen } from 'expo-router/testing-library';

// Regression: on iOS the app opened to a blank screen because two files claimed "/".
describe('app routing', () => {
  it('opens on the Feed', async () => {
    await renderRouter('./src/app', { initialUrl: '/' });
    expect(await screen.findByText('Find your people.')).toBeTruthy();
  });
});
