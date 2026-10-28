import * as Location from 'expo-location';

export type LocationOutcome = 'granted' | 'denied' | 'unavailable';

/**
 * Asks iOS for "While Using the App" location. We only ask: coordinates are used on the phone for
 * distance and are never read here, stored or sent anywhere.
 */
export async function requestLocationPermission(): Promise<LocationOutcome> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === Location.PermissionStatus.GRANTED ? 'granted' : 'denied';
  } catch {
    return 'unavailable';
  }
}
