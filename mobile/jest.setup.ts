// Reanimated needs native modules that don't exist in Jest, so replace the few
// pieces the design system uses with plain React Native equivalents.
jest.mock('react-native-reanimated', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View },
    useReducedMotion: () => true,
    useSharedValue: (v: unknown) => ({ value: v, set: () => {} }),
    useAnimatedStyle: () => ({}),
    withRepeat: (v: unknown) => v,
    withTiming: (v: unknown) => v,
    Easing: { linear: (t: number) => t },
    withSpring: (v: unknown) => v,
    withSequence: (...v: unknown[]) => v[v.length - 1],
  };
});
