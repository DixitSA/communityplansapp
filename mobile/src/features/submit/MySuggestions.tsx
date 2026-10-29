import { View } from 'react-native';

import { AppText, useTheme } from '@/design';
import { formatShortDate } from '@/lib/dates';

import { submissionStatusLabel } from './format';
import { useMySubmissions } from './useSubmitEvent';

/** "Your suggestions": title, status and date. Renders nothing until there is at least one. */
export function MySuggestions() {
  const { colors, space, radius } = useTheme();
  const { data } = useMySubmissions();
  if (!data || data.length === 0) return null;
  return (
    <View style={{ gap: space.sm }}>
      <AppText variant="footnote" color="inkSecondary" accessibilityRole="header" style={{ fontWeight: '500', paddingLeft: space.xs }}>
        Your suggestions
      </AppText>
      <View style={{ borderRadius: radius.card, borderCurve: 'continuous', backgroundColor: colors.surface, overflow: 'hidden' }}>
        {data.map((s, i) => {
          const status = submissionStatusLabel(s.status);
          const date = formatShortDate(s.createdAt);
          return (
            <View
              key={s.id}
              accessible
              accessibilityLabel={`${s.title}, ${status}, suggested ${date}`}
              style={{
                paddingHorizontal: space.lg,
                paddingVertical: space.md,
                gap: space.xs,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.line,
              }}
            >
              <AppText variant="body" numberOfLines={1}>
                {s.title}
              </AppText>
              <AppText variant="footnote" color={s.status === 'approved' ? 'accent' : 'inkSecondary'}>
                {status} · {date}
              </AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}
