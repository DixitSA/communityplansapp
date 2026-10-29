import * as Location from 'expo-location';

export type Origin = { lat: number; lng: number };

/** Uptown Charlotte: used whenever we don't already have the device's position. */
export const CHARLOTTE_CENTER: Origin = { lat: 35.2271, lng: -80.8431 };

/** Two decimals is about 1 km: enough for a feed, and small movements don't refetch it. */
const round = (n: number) => Math.round(n * 100) / 100;

/**
 * Where the feed is centered. Uses the device's last known position only if location permission
 * was already granted; this never asks. The position goes nowhere except as `get_feed` arguments
 * (which the server does not store).
 */
export async function getOrigin(): Promise<Origin> {
  try {
    const permission = await Location.getForegroundPermissionsAsync();
    if (!permission.granted) return CHARLOTTE_CENTER;
    const position = await Location.getLastKnownPositionAsync();
    if (!position) return CHARLOTTE_CENTER;
    return { lat: round(position.coords.latitude), lng: round(position.coords.longitude) };
  } catch {
    return CHARLOTTE_CENTER;
  }
}
