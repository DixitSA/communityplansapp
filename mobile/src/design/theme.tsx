import { useColorScheme } from 'react-native';

import {
  cardShadow,
  darkColors,
  lightColors,
  radius,
  space,
  type,
  type Colors,
  type Scheme,
} from './tokens';

export type Theme = {
  scheme: Scheme;
  colors: Colors;
  space: typeof space;
  radius: typeof radius;
  type: typeof type;
  shadow: { boxShadow?: string };
};

/** Reads the phone's light/dark setting and returns all design tokens for it. */
export function useTheme(): Theme {
  const scheme: Scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return {
    scheme,
    colors: scheme === 'dark' ? darkColors : lightColors,
    space,
    radius,
    type,
    shadow: cardShadow[scheme],
  };
}
