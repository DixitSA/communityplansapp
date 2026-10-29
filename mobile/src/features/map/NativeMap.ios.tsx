import { AppleMaps } from 'expo-maps';
import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { CHARLOTTE } from './coords';
import type { NativeMapProps } from './NativeMap';

// Zoom is a fixed object so re-renders don't re-center the map under the user's finger.
const CAMERA = { coordinates: CHARLOTTE, zoom: 11.5 };
const UI = { compassEnabled: false, myLocationButtonEnabled: false, scaleBarEnabled: false };

/** Apple Maps (expo-maps) with one marker per event, tinted by category and showing the interest's SF Symbol. */
export function NativeMap({ pins, onSelect, onDeselect }: NativeMapProps) {
  const markers = useMemo(
    () =>
      pins.map((p) => ({
        id: p.id,
        title: p.title,
        coordinates: p.coordinate,
        tintColor: p.color,
        systemImage: p.symbol,
      })),
    [pins],
  );
  return (
    <AppleMaps.View
      style={StyleSheet.absoluteFill}
      cameraPosition={CAMERA}
      markers={markers}
      uiSettings={UI}
      onMarkerClick={(m) => {
        if (m.id) onSelect(m.id);
      }}
      onMapClick={onDeselect}
    />
  );
}
