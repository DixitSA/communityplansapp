import { Platform, type ViewStyle } from 'react-native';

/**
 * CSS-style linear gradient as a View style. Native uses RN's `experimental_backgroundImage`;
 * react-native-web ignores that prop but passes plain CSS `backgroundImage` straight through.
 */
export function linearGradient(css: string): ViewStyle {
  if (Platform.OS === 'web') {
    // `backgroundImage` isn't in RN's ViewStyle type, but react-native-web forwards it to CSS.
    return { backgroundImage: css } as ViewStyle;
  }
  return { experimental_backgroundImage: css };
}

/** Gradient used wherever a real mesh gradient isn't available (web, Android). */
export function gradientBackground(colors: string[]): ViewStyle {
  return {
    backgroundColor: colors[0],
    ...linearGradient(`linear-gradient(135deg, ${colors[0]}, ${colors[4]} 55%, ${colors[8]})`),
  };
}
