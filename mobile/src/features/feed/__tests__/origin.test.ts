import * as Location from 'expo-location';

import { CHARLOTTE_CENTER, getOrigin } from '../origin';

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
}));

const perm = Location.getForegroundPermissionsAsync as jest.Mock;
const last = Location.getLastKnownPositionAsync as jest.Mock;

describe('getOrigin', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses the device position when permission is already granted', async () => {
    perm.mockResolvedValue({ granted: true });
    last.mockResolvedValue({ coords: { latitude: 35.30123, longitude: -80.71987 } });
    expect(await getOrigin()).toEqual({ lat: 35.3, lng: -80.72 });
  });

  it('falls back to Charlotte without permission, and never asks for it', async () => {
    perm.mockResolvedValue({ granted: false });
    expect(await getOrigin()).toEqual(CHARLOTTE_CENTER);
    expect(last).not.toHaveBeenCalled();
    expect(Location.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
  });

  it('falls back when there is no known position or location throws', async () => {
    perm.mockResolvedValue({ granted: true });
    last.mockResolvedValue(null);
    expect(await getOrigin()).toEqual(CHARLOTTE_CENTER);
    perm.mockRejectedValue(new Error('boom'));
    expect(await getOrigin()).toEqual(CHARLOTTE_CENTER);
  });
});
