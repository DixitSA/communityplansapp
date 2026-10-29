import { useQuery } from '@tanstack/react-query';

import { api, demoEvent, type EventPage } from '@/lib/api';
import { isBackendConfigured } from '@/lib/env';

/** One event for the event page and the Going sheet. `data` is null when the event doesn't exist. */
export function useEvent(id: string) {
  return useQuery<EventPage | null>({
    queryKey: ['event', id],
    queryFn: () => api.getEvent(id),
    // Sample events are local, so they show on the first frame.
    initialData: isBackendConfigured ? undefined : () => demoEvent(id),
  });
}
