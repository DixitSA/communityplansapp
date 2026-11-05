import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { NativeMap } from '../NativeMap.ios';
import type { Pin } from '../pins';

jest.mock('expo-maps', () => ({
  AppleMaps: {
    View: (props: { markers?: unknown[] }) =>
      jest.requireActual<typeof import('react')>('react').createElement(
        jest.requireActual<typeof import('react-native')>('react-native').View,
        {
          testID: 'apple-map',
          accessibilityLabel: `${props.markers?.length ?? 0} map markers`,
        },
      ),
  },
}));

const originalPlatformVersion = Object.getOwnPropertyDescriptor(Platform, 'Version');
const pins: Pin[] = [
  {
    id: 'event-1',
    title: 'Rooftop Jazz Night',
    coordinate: { latitude: 35.2271, longitude: -80.8431 },
    color: '#000000',
    symbol: 'music.note',
    neighborhood: 'Uptown',
  },
];

function setIOSVersion(version: number | string) {
  Object.defineProperty(Platform, 'Version', { configurable: true, value: version });
}

afterEach(() => {
  if (originalPlatformVersion) Object.defineProperty(Platform, 'Version', originalPlatformVersion);
});

it.each([16.4, 16.7, '16.7.1', 17, '17.7.1'])('shows an event-selectable fallback on iOS %s', async (version) => {
  setIOSVersion(version);
  const onSelect = jest.fn();

  await render(<NativeMap pins={pins} selectedId={null} onSelect={onSelect} onDeselect={jest.fn()} />);

  expect(screen.getByText('Interactive maps require iOS 18 or later')).toBeTruthy();
  expect(screen.getByText('You can still choose an event below.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Rooftop Jazz Night, Uptown' }));
  expect(onSelect).toHaveBeenCalledWith('event-1');
  expect(screen.queryByTestId('apple-map')).toBeNull();
});

it.each([18, '18.0.0'])('keeps the native marker map on iOS %s and later', async (version) => {
  setIOSVersion(version);

  await render(<NativeMap pins={pins} selectedId={null} onSelect={jest.fn()} onDeselect={jest.fn()} />);

  expect(screen.getByTestId('apple-map')).toBeTruthy();
  expect(screen.getByLabelText('1 map markers')).toBeTruthy();
  expect(screen.queryByText('Interactive maps require iOS 18 or later')).toBeNull();
});
