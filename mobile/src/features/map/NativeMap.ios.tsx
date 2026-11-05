import { AppleMaps } from 'expo-maps';
import { useMemo } from 'react';
import { Platform, StyleSheet } from 'react-native';

import { CHARLOTTE } from './coords';
import { PinListFallback } from './PinListFallback';
import type { NativeMapProps } from './NativeMap';

// Zoom is a fixed object so re-renders don't re-center the map under the user's finger.
const CAMERA = { coordinates: CHARLOTTE, zoom: 11.5 };
const UI = { compassEnabled: false, myLocationButtonEnabled: false, scaleBarEnabled: false };

/** Apple Maps (expo-maps) with one marker per event, tinted by category and showing the interest's SF Symbol. */
export function NativeMap({ pins, selectedId, onSelect, onDeselect }: NativeMapProps) {
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

  // expo-maps renders Apple Maps only on iOS 17+, and marker selection is
  // unavailable until iOS 18. Keep event selection usable on older phones.
  const iosMajorVersion = Number.parseInt(String(Platform.Version), 10);
  if (iosMajorVersion < 18 || Number.isNaN(iosMajorVersion)) {
    return (
      <PinListFallback
        pins={pins}
        selectedId={selectedId}
        onSelect={onSelect}
        title="Interactive maps require iOS 18 or later"
        description="You can still choose an event below."
      />
    );
  }

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
