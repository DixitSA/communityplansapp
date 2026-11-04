import { warning } from '@/lib/haptics';
import { showMenu } from '@/lib/menu';

/** Leaving a chat means leaving Going, so it only makes sense while you're Going and the chat is still open. */
export function canLeaveChat(plan: string | null | undefined, open: boolean): boolean {
  return plan === 'going' && open;
}

/** Confirm sheet (action sheet on iOS, alert elsewhere). `onConfirm` runs only on "Leave chat". */
export function confirmLeaveChat(onConfirm: () => void): void {
  showMenu(
    'leave this chat?',
    [
      {
        label: 'Leave chat',
        destructive: true,
        run: () => {
          warning();
          onConfirm();
        },
      },
    ],
    'you’ll stop Going and leave the chat. it stays saved as Interested.',
  );
}

/** The ⋯ menu in the chat header. */
export function openChatMenu(opts: { canLeave: boolean; onViewEvent: () => void; onLeave: () => void }): void {
  showMenu(undefined, [
    { label: 'View event', run: opts.onViewEvent },
    ...(opts.canLeave ? [{ label: 'Leave chat', destructive: true, run: () => confirmLeaveChat(opts.onLeave) }] : []),
  ]);
}
