import { AppText, EmptyState, Screen } from '@/design';

export default function ChatsScreen() {
  return (
    <Screen>
      <AppText variant="largeTitle">Chats</AppText>
      <EmptyState
        symbol="bubble.left.and.bubble.right"
        title="No chats yet"
        message="When you say you're Going, the event's group chat shows up here."
      />
    </Screen>
  );
}
