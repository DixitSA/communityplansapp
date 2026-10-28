import { View } from 'react-native';

import { useTheme } from '../theme';
import { AppText } from './AppText';

export type StepProgressProps = {
  /** 1-based current step. */
  step: number;
  total?: number;
};

/** "Step 2 of 4" with a segmented bar. */
export function StepProgress({ step, total = 4 }: StepProgressProps) {
  const { colors, space, radius } = useTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`Step ${step} of ${total}`}
      accessibilityValue={{ min: 1, max: total, now: step }}
      style={{ flex: 1, gap: space.sm }}
    >
      <View style={{ flexDirection: 'row', gap: space.xs }}>
        {Array.from({ length: total }, (_, i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: radius.pill,
              backgroundColor: i < step ? colors.accent : colors.line,
            }}
          />
        ))}
      </View>
      <AppText variant="caption" color="inkSecondary" maxFontSizeMultiplier={1.4}>
        Step {step} of {total}
      </AppText>
    </View>
  );
}
