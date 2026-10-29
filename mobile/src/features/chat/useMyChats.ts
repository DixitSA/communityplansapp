import { useQuery } from '@tanstack/react-query';

import { usePlansStore } from '@/features/event/plansStore';
import { chatService } from '@/lib/chat';

export const CHATS_KEY = 'chats';

/**
 * The chat list. Each chat is an event the viewer is Going to. In demo mode "Going" lives in the
 * local plans store, so the list also refetches when that changes.
 */
export function useMyChats() {
  const goingIds = usePlansStore((s) =>
    Object.entries(s.statuses)
      .filter(([, status]) => status === 'going')
      .map(([id]) => id)
      .sort()
      .join(','),
  );
  return useQuery({
    queryKey: [CHATS_KEY, goingIds],
    queryFn: () => chatService.getMyChats(),
  });
}
