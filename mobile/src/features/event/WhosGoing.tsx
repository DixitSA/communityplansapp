import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import Animated, { FadeIn, useReducedMotion } from 'react-native-reanimated';

import { AppText, Avatar, Icon, useTheme } from '@/design';

import { userHref } from '../friends/routes';
import { othersLabel } from './plansLogic';

type Person = { id: string; name: string };

export type WhosGoingProps = {
  friends: Person[];
  /** All friends going (>= friends.length). */
  friendsGoing: number;
  /** Other attendees. Pass an empty list until the viewer is Going, so their names never reach the screen. */
  others: Person[];
  /** All other people going (>= others.length). */
  othersGoing: number;
  revealed: boolean;
};

const FACE = 52;
const REDACTED_FACE = 40;
const REDACTED_FACES = 5;

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

function PersonTile({ person }: { person: Person }) {
  const { space } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${person.name}`}
      accessibilityHint="Opens profile"
      onPress={() => router.push(userHref(person.id))}
      style={({ pressed }) => ({ width: FACE + space.md, alignItems: 'center', gap: space.xs, opacity: pressed ? 0.7 : 1 })}
    >
      <Avatar name={person.name} size={FACE} />
      <AppText variant="footnote" numberOfLines={1} maxFontSizeMultiplier={1.4}>
        {firstName(person.name)}
      </AppText>
    </Pressable>
  );
}

function CountTile({ count, caption }: { count: number; caption: string }) {
  const { colors, space } = useTheme();
  return (
    <View style={{ width: FACE + space.md, alignItems: 'center', gap: space.xs }}>
      <View
        style={{
          width: FACE,
          height: FACE,
          borderRadius: FACE / 2,
          backgroundColor: colors.surfaceMuted,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppText variant="subheadline" rounded style={{ fontWeight: '600' }}>
          +{count}
        </AppText>
      </View>
      <AppText variant="footnote" color="inkSecondary" numberOfLines={1}>
        {caption}
      </AppText>
    </View>
  );
}

/** Faceless circles standing in for people we aren't allowed to show yet. */
function RedactedFacepile() {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: REDACTED_FACES }, (_, i) => (
        <View
          key={i}
          style={{
            marginLeft: i === 0 ? 0 : -REDACTED_FACE * 0.3,
            width: REDACTED_FACE,
            height: REDACTED_FACE,
            borderRadius: REDACTED_FACE / 2,
            borderCurve: 'continuous',
            backgroundColor: colors.surfaceMuted,
            borderWidth: 2,
            borderColor: colors.canvas,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 1 - i * 0.14,
          }}
        >
          <Icon name="person.fill" size={REDACTED_FACE * 0.45} color="inkSecondary" />
        </View>
      ))}
    </View>
  );
}

/**
 * "Who's going". Friends show by name and face. Other attendees are a redacted facepile until the
 * viewer is Going: the privacy rule is the reason to commit (DESIGN.md 4.6).
 */
export function WhosGoing({ friends, friendsGoing, others, othersGoing, revealed }: WhosGoingProps) {
  const { space } = useTheme();
  const reduced = useReducedMotion();
  const moreFriends = Math.max(friendsGoing - friends.length, 0);
  const moreOthers = Math.max(othersGoing - others.length, 0);

  return (
    <View style={{ gap: space.lg }}>
      <AppText variant="title2" accessibilityRole="header">
        Who&apos;s going
      </AppText>

      <View style={{ gap: space.sm }}>
        <AppText variant="overline" color="inkSecondary">
          Friends
        </AppText>
        {friends.length > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}>
            {friends.map((p) => (
              <PersonTile key={p.id} person={p} />
            ))}
            {moreFriends > 0 ? <CountTile count={moreFriends} caption="more" /> : null}
          </View>
        ) : (
          <AppText variant="subheadline" color="inkSecondary">
            None of your friends are going yet.
          </AppText>
        )}
      </View>

      {othersGoing > 0 ? (
        <View style={{ gap: space.sm }}>
          <AppText variant="overline" color="inkSecondary">
            Everyone else
          </AppText>
          {revealed ? (
            <Animated.View
              entering={reduced ? undefined : FadeIn.duration(300)}
              style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md }}
            >
              {others.map((p) => (
                <PersonTile key={p.id} person={p} />
              ))}
              {moreOthers > 0 ? <CountTile count={moreOthers} caption="more" /> : null}
            </Animated.View>
          ) : (
            <View
              accessible
              accessibilityLabel={`${othersGoing} others are going. Go to see who's going.`}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
            >
              <RedactedFacepile />
              <View style={{ flexShrink: 1, gap: 2 }}>
                <AppText variant="headline">{othersLabel(othersGoing)}</AppText>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                  <Icon name="lock.fill" size={11} color="inkSecondary" />
                  <AppText variant="footnote" color="inkSecondary" style={{ flexShrink: 1 }}>
                    Go to see who&apos;s going
                  </AppText>
                </View>
              </View>
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}
