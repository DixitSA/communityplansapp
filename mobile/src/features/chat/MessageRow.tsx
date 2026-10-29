import { memo } from 'react';
import { Pressable, View } from 'react-native';

import { AppText, Avatar, useTheme } from '@/design';
import type { ChatMessage } from '@/lib/api';
import { light } from '@/lib/haptics';

import { messageA11yLabel, type MessageItem } from './messages';

const AVATAR = 28;

export type MessageRowProps = {
  item: MessageItem;
  onOpenMenu: (message: ChatMessage) => void;
};

/** One bubble. Mine sit on the right in the accent color; everyone else's on the left, with a name and face at the start of a group. */
function MessageRowBase({ item, onOpenMenu }: MessageRowProps) {
  const { colors, space, radius, scheme } = useTheme();
  const { message, startsGroup, endsGroup } = item;
  const mine = message.isMine;
  const deleted = message.deleted || message.body === null;
  const canOpenMenu = !deleted && !message.sending;

  // Every corner is round except the small "tail" on the sender's side of the last bubble.
  const tail = space.xs;
  const bubbleShape = {
    borderRadius: radius.card,
    borderCurve: 'continuous' as const,
    ...(endsGroup ? (mine ? { borderBottomRightRadius: tail } : { borderBottomLeftRadius: tail }) : null),
  };

  const open = () => {
    if (!canOpenMenu) return;
    light();
    onOpenMenu(message);
  };

  const bubble = (
    <Pressable
      accessible
      accessibilityLabel={messageA11yLabel(message)}
      accessibilityHint={canOpenMenu ? 'Press and hold for options' : undefined}
      accessibilityActions={canOpenMenu ? [{ name: 'longpress', label: 'Message options' }] : undefined}
      onAccessibilityAction={open}
      onLongPress={open}
      style={[
        bubbleShape,
        {
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          backgroundColor: deleted ? 'transparent' : mine ? colors.accent : colors.surface,
          borderWidth: deleted || !mine ? 1 : 0,
          borderColor: deleted ? colors.line : scheme === 'dark' ? colors.line : 'transparent',
          opacity: message.sending ? 0.6 : 1,
        },
      ]}
    >
      <AppText
        variant="body"
        color={deleted ? 'inkSecondary' : mine ? 'onAccent' : 'ink'}
        style={deleted ? { fontStyle: 'italic' } : undefined}
      >
        {deleted ? 'Message deleted' : message.body}
      </AppText>
    </Pressable>
  );

  return (
    <View
      style={{
        paddingHorizontal: space.lg,
        marginTop: startsGroup ? space.md : 2,
        flexDirection: 'row',
        justifyContent: mine ? 'flex-end' : 'flex-start',
        gap: space.sm,
      }}
    >
      {mine ? null : (
        <View style={{ width: AVATAR }}>{startsGroup ? <Avatar name={message.displayName} size={AVATAR} /> : null}</View>
      )}
      <View style={{ maxWidth: '78%', alignItems: mine ? 'flex-end' : 'flex-start', flexShrink: 1 }}>
        {!mine && startsGroup ? (
          <AppText
            variant="caption"
            color="inkSecondary"
            numberOfLines={1}
            style={{ marginBottom: 2, marginLeft: space.md, fontWeight: '600' }}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {message.displayName}
          </AppText>
        ) : null}
        {bubble}
      </View>
    </View>
  );
}

export const MessageRow = memo(MessageRowBase);
